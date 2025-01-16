// Configuration - replace with your actual values



function createAuthHeader(username, password) {
    // Combine username and password with a colon
    const credentials = `${username}:${password}`;

    // Base64 encode the credentials
    const base64Credentials = btoa(credentials);

    // Construct the Authorization header
    return `Basic ${base64Credentials}`;
}


async function handleRequest(request, env, ctx) {

    const MAVEN_REPO_URL = env.MAVEN_REPO_URL || 'https://repo.maven.apache.org/maven2/'
    const cacheTime = parseInt(env.CACHE_TTL || '2592000'); // Default 30 days
    // Check cache first
    const cache = caches.default
    let response = await cache.match(request)

    if (response) {
        return response
    }

    // Forward request to Maven repository
    const url = new URL(request.url)
    const mavenUrl = `${MAVEN_REPO_URL}${url.pathname}${url.search}`

    try {
        // const authHeader = createAuthHeader('aamdeploy', 'n2PzS4XV3b4Em8Hf')
        const authHeader = request.headers.get('Authorization') || '';
        // Forward the request with the same credentials
        response = await fetch(mavenUrl, {
            method: request.method,
            headers: {
                'Authorization': authHeader,
                'User-Agent': request.headers.get('User-Agent') || 'Cloudflare Worker'
            }
        })

        // Only cache successful GET requests
        if (request.method === 'GET' && response.ok) {
            // Clone the response before caching
            const responseToCache = response.clone()

            // Create new response with custom cache headers
            const modifiedResponse = new Response(responseToCache.body, {
                status: responseToCache.status,
                statusText: responseToCache.statusText,
                headers: responseToCache.headers
            })

            // Set cache control headers
            modifiedResponse.headers.set('Cache-Control', `public, max-age=${cacheTime}`)

            // Put in cache
            await cache.put(request, modifiedResponse.clone())

            return modifiedResponse
        }

        return response
    } catch (error) {
        return new Response(`Error fetching from Maven repository: ${error.message}`, {
            status: 502
        })
    }
}

export default {
    async fetch(request, env, ctx) {
      try {
        return await handleRequest(request, env, ctx);
      } catch (error) {
        await debugLog('Unhandled error', { error: error.message, stack: error.stack });
        return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
      }
    }
  };