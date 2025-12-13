// Bearer token for authentication
const BEARER_TOKEN = 'HhkNhaAu4fAKysAFJ0nHed6TX9qEwKlKk/nqlcyE0c4=';

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Target-Authorization',
        }
      });
    }

    // Check bearer token authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('Unauthorized: Missing or invalid Authorization header', {
        status: 401,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    if (token !== BEARER_TOKEN) {
      return new Response('Unauthorized: Invalid token', {
        status: 401,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Get the target URL from the query parameter or path
    const url = new URL(request.url);

    // Extract target URL from 'url' query parameter
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Usage: https://your-worker.workers.dev/?url=https://example.com', {
        status: 400,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    try {
      // Parse and validate the target URL
      const target = new URL(targetUrl);

      // Get the target authorization header if provided
      const targetAuth = request.headers.get('X-Target-Authorization');

      // Create headers for the outbound request
      const headers = new Headers(request.headers);

      // Remove proxy-specific and cloudflare-specific headers
      headers.delete('Authorization'); // Remove proxy token
      headers.delete('X-Target-Authorization'); // Remove this custom header
      headers.delete('cf-connecting-ip');
      headers.delete('cf-ray');
      headers.delete('cf-visitor');

      // If target authorization was provided, set it as the Authorization header
      if (targetAuth) {
        headers.set('Authorization', targetAuth);
      }

      // Forward the request
      const response = await fetch(target.href, {
        method: request.method,
        headers: headers,
        body: request.body,
        redirect: 'follow'
      });

      // Create a new response with CORS headers
      const proxyResponse = new Response(response.body, response);
      proxyResponse.headers.set('Access-Control-Allow-Origin', '*');
      proxyResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      proxyResponse.headers.set('Access-Control-Allow-Headers', '*');
      proxyResponse.headers.set('X-Proxied-By', 'Cloudflare-US-Worker');

      return proxyResponse;
    } catch (error) {
      return new Response(`Proxy Error: ${error.message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
};
