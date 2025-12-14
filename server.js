import express from 'express';

const app = express();
const PORT = 3000;
const BEARER_TOKEN = 'HhkNhaAu4fAKysAFJ0nHed6TX9qEwKlKk/nqlcyE0c4=';

// Headers that should not be forwarded
const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'authorization',
  'x-target-authorization',
  'content-length',
  'accept-encoding'
];

app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: '*/*', limit: '10mb' }));

// CORS preflight
app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Target-Authorization');
  res.status(200).end();
});

app.all('*', async (req, res) => {
  try {
    // Check authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).send('Unauthorized: Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);
    if (token !== BEARER_TOKEN) {
      return res.status(401).send('Unauthorized: Invalid token');
    }

    // Get target URL
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).send('Usage: ?url=https://example.com');
    }

    // Prepare headers - filter out hop-by-hop headers
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (!HOP_BY_HOP_HEADERS.includes(key.toLowerCase())) {
        headers[key] = value;
      }
    }

    // Add target auth if provided
    const targetAuth = req.headers['x-target-authorization'];
    if (targetAuth) {
      headers['authorization'] = targetAuth;
    }

    // Forward request
    const fetchOptions = {
      method: req.method,
      headers: headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = typeof req.body === 'object' && !Buffer.isBuffer(req.body) 
        ? JSON.stringify(req.body) 
        : req.body;
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Copy response headers (excluding hop-by-hop)
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    // Add CORS headers
    responseHeaders['Access-Control-Allow-Origin'] = '*';
    responseHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    responseHeaders['Access-Control-Allow-Headers'] = '*';
    responseHeaders['X-Proxied-By'] = 'Hetzner-US-VPS';

    // Send response
    const body = await response.arrayBuffer();
    res.status(response.status).set(responseHeaders).send(Buffer.from(body));

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send(`Proxy Error: ${error.message}`);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`US Proxy running on http://0.0.0.0:${PORT}`);
});
