// Docker Hub API endpoints
const DOCKERHUB_AUTH = "https://auth.docker.io/token";
const DOCKERHUB_REGISTRY = "https://registry-1.docker.io/v2";

async function debugLog(message, data) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    message,
    data
  }));
}

async function handleRequest(request, env) {
  const maxCacheSize = 128 * 1024 * 1024; // worker will raise an error while the response with body exceed 128MB executes clone() method
  // https://developers.cloudflare.com/workers/platform/limits/#memory

  // Get environment variables with defaults
  const cacheTime = parseInt(env.CACHE_TIME || '2592000'); // Default 30 days

  const url = new URL(request.url);
  const path = url.pathname;
  const cache = caches.default
  let response = await cache.match(url)

  if (response) {
    await debugLog('Cache hit', {key: request});
    return response
  }

  await debugLog('Cache miss', {request});

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

    // Check the size of the response before caching
    const contentLength = response.headers.get('Content-Length');

    await debugLog('Cache size check', {
      contentLength,
      maxCacheSize,
      willCache: contentLength && parseInt(contentLength) < maxCacheSize
    });

    if (request.method === 'GET' && response.ok && contentLength && parseInt(contentLength) < maxCacheSize) {
        // Clone the response before caching
        const responseToCache = response;

        // Create new response with custom cache headers
        const modifiedResponse = new Response(responseToCache.body, {
          status: responseToCache.status,
          statusText: responseToCache.statusText,
          headers: responseToCache.headers
        });

        // Set cache control headers
        modifiedResponse.headers.set('Cache-Control', `public, max-age=${cacheTime}`);

        // Put in cache
        await cache.put(request, modifiedResponse.clone());
        await debugLog('Response cached successfully', {
          size: contentLength,
          key: request,
          cacheTime
        });

      return modifiedResponse;
    }
    return response;

  } catch (error) {
    await debugLog('Request handling error', { error: error.message });
    return new Response(`Failed to proxy request: ${error.message}`, { status: 500 });
  }
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      await debugLog('Unhandled error', { error: error.message, stack: error.stack });
      return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
    }
  }
};