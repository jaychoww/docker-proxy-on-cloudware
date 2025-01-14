// Docker Hub API endpoints
const DOCKERHUB_AUTH = "https://auth.docker.io/token";
const DOCKERHUB_REGISTRY = "https://registry-1.docker.io/v2";

// Cache settings
const CACHE_TIMEOUT = 60 * 60 * 24 * 30; // 24 hours in seconds

async function debugLog(message, data) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    message,
    data
  }));
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  await debugLog('Incoming request', { path, method: request.method });

  // Handle ping request
  if (path === '/v2/' || path === '/v2') {
    return new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Parse image name and tag
  let imageName, reference, type;
  
  try {
    if (path.startsWith('/v2/')) {
      const parts = path.slice(4).split('/');
      if (parts.length >= 3) {
        type = parts[parts.length - 2];
        reference = parts[parts.length - 1];
        imageName = parts.slice(0, parts.length - 2).join('/');
      }
    } else {
      const pathParts = path.slice(1).split(':');
      imageName = pathParts[0];
      reference = pathParts[1] || 'latest';
      type = 'manifests';
      console.log("imageName:", imageName);  

    }
    if (!imageName.includes('/')) {

      imageName = `library/${imageName}`;
    }

    await debugLog('Parsed image info', { imageName, reference, type });

    if (!imageName || !reference) {
      throw new Error(`Invalid image name or reference: ${path}`);
    }
  } catch (error) {
    await debugLog('Path parsing error', { error: error.message });
    return new Response(`Invalid request path: ${error.message}`, { status: 400 });
  }

  // Get Docker Hub authentication token
  let authData;
  try {
    const scope = `repository:${imageName}:pull`;
    const authUrl = `${DOCKERHUB_AUTH}?service=registry.docker.io&scope=${scope}`;
    await debugLog('Requesting auth token', { authUrl });

    const authResponse = await fetch(authUrl, {
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (!authResponse.ok) {
      throw new Error(`Auth response status: ${authResponse.status}, body: ${await authResponse.text()}`);
    }

    authData = await authResponse.json();
    await debugLog('Received auth token', { tokenExists: !!authData.token });
  } catch (error) {
    await debugLog('Authentication error', { error: error.message });
    return new Response(`Authentication failed: ${error.message}`, { status: 401 });
  }

  // Forward request to Docker Hub
  try {
    const dockerHubUrl = `${DOCKERHUB_REGISTRY}/${imageName}/${type}/${reference}`;
    await debugLog('Forwarding to Docker Hub', { url: dockerHubUrl });

    const acceptHeader = type === 'manifests' 
      ? 'application/vnd.docker.distribution.manifest.v2+json,application/vnd.docker.distribution.manifest.list.v2+json'
      : 'application/octet-stream';

    const response = await fetch(dockerHubUrl, {
      headers: {
        'Authorization': `Bearer ${authData.token}`,
        'Accept': acceptHeader
      }
    });

    await debugLog('Received Docker Hub response', { 
      status: response.status,
      headers: Object.fromEntries(response.headers)
    });

    if (!response.ok) {
      const errorText = await response.text();
      await debugLog('Docker Hub error response', { error: errorText });
      return new Response(errorText, { 
        status: response.status,
        headers: response.headers
      });
    }

    // Clone the response and add caching headers
    const responseClone = new Response(response.body, response);
    responseClone.headers.set('Cache-Control', `public, max-age=${CACHE_TIMEOUT}`);
    
    // Attempt to cache the response
    try {
      const cache = caches.default;
      await cache.put(request, responseClone.clone());
      await debugLog('Response cached successfully');
    } catch (err) {
      await debugLog('Cache error', { error: err.message });
    }

    return responseClone;
  } catch (error) {
    await debugLog('Request handling error', { error: error.message });
    return new Response(`Failed to proxy request: ${error.message}`, { status: 500 });
  }
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request)
    .catch(async error => {
      await debugLog('Unhandled error', { error: error.message, stack: error.stack });
      return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
    })
  );
});