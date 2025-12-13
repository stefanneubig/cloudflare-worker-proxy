export default {
  async fetch(request, env, ctx) {
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

      // Create a new request with the same method, headers, and body
      const proxyRequest = new Request(target.href, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'follow'
      });

      // Remove cloudflare-specific headers
      const headers = new Headers(proxyRequest.headers);
      headers.delete('cf-connecting-ip');
      headers.delete('cf-ray');
      headers.delete('cf-visitor');

      // Forward the request
      const response = await fetch(target.href, {
        method: proxyRequest.method,
        headers: headers,
        body: proxyRequest.body,
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
