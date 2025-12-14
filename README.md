# Cloudflare Worker Proxy

> **⚠️ MIGRATED TO HETZNER VPS**
>
> This repo originally used Cloudflare Workers but has migrated to Hetzner VPS for guaranteed US IP routing.
> Cloudflare Workers cannot control egress IP location - traffic exits from the nearest datacenter.
>
> **Current implementation:** See [HETZNER_SETUP.md](HETZNER_SETUP.md)
> **New endpoint:** `https://proxy-us.sgl.as`
> **Status:** Cloudflare Worker deprecated (returns HTTP 410)

A simple, secure HTTP proxy that routes traffic through US data centers. Perfect for accessing geo-restricted APIs or services that require US IP addresses.

## Features

- **US-based routing** - Traffic routes through Cloudflare's US infrastructure
- **Bearer token authentication** - Secure access with API token
- **X-Target-Authorization support** - Seamlessly proxy to APIs that require their own Authorization headers
- **CORS enabled** - Works with browser-based applications
- **100% serverless** - No servers to maintain, runs on Cloudflare's edge network
- **Free tier** - 100,000 requests per day at no cost

## Live Endpoint

```
https://us-proxy.sonnenglas.workers.dev
```

## Quick Start

### Basic Usage

```bash
curl "https://us-proxy.sonnenglas.workers.dev/?url=https://api.ipify.org?format=json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### With OpenRouter or Other APIs

When proxying to APIs that require their own Authorization header (like OpenRouter, OpenAI, etc.), use the `X-Target-Authorization` header:

```bash
curl "https://us-proxy.sonnenglas.workers.dev/?url=https://openrouter.ai/api/v1/chat/completions" \
  -H "Authorization: Bearer YOUR_PROXY_TOKEN" \
  -H "X-Target-Authorization: Bearer sk-or-v1-YOUR_OPENROUTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Authentication

The proxy uses bearer token authentication to prevent unauthorized access.

### Your Proxy Token

```
HhkNhaAu4fAKysAFJ0nHed6TX9qEwKlKk/nqlcyE0c4=
```

Always include this in the `Authorization` header:

```
Authorization: Bearer HhkNhaAu4fAKysAFJ0nHed6TX9qEwKlKk/nqlcyE0c4=
```

### Changing the Token

To change your proxy token:

1. Generate a new token:
   ```bash
   openssl rand -base64 32
   ```

2. Update `src/index.js`:
   ```javascript
   const BEARER_TOKEN = 'YOUR_NEW_TOKEN_HERE';
   ```

3. Deploy:
   ```bash
   wrangler deploy
   ```

## How It Works

### Header Forwarding

The proxy intelligently handles Authorization headers to avoid conflicts:

1. **Validates your proxy token** from the `Authorization` header
2. **Removes the proxy token** before forwarding
3. **Forwards `X-Target-Authorization`** as `Authorization` to the target API

**Example:**

You send:
```
Authorization: Bearer <proxy-token>
X-Target-Authorization: Bearer <api-key>
```

Target API receives:
```
Authorization: Bearer <api-key>
```

This solves the problem where both the proxy and target API need Authorization headers.

### Removed Headers

The following headers are stripped before forwarding:
- `Authorization` (your proxy token)
- `X-Target-Authorization` (forwarded as Authorization)
- `cf-connecting-ip`
- `cf-ray`
- `cf-visitor`

## Usage Examples

### JavaScript/Fetch

```javascript
const response = await fetch('https://us-proxy.sonnenglas.workers.dev/?url=https://api.example.com/data', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer HhkNhaAu4fAKysAFJ0nHed6TX9qEwKlKk/nqlcyE0c4='
  }
});

const data = await response.json();
```

### Python

```python
import requests

headers = {
    'Authorization': 'Bearer HhkNhaAu4fAKysAFJ0nHed6TX9qEwKlKk/nqlcyE0c4='
}

response = requests.get(
    'https://us-proxy.sonnenglas.workers.dev/',
    params={'url': 'https://api.example.com/data'},
    headers=headers
)

print(response.json())
```

### With Target API Authentication

```python
import requests

headers = {
    'Authorization': 'Bearer HhkNhaAu4fAKysAFJ0nHed6TX9qEwKlKk/nqlcyE0c4=',
    'X-Target-Authorization': 'Bearer sk-your-api-key',
    'Content-Type': 'application/json'
}

data = {
    'model': 'openai/gpt-3.5-turbo',
    'messages': [{'role': 'user', 'content': 'Hello!'}]
}

response = requests.post(
    'https://us-proxy.sonnenglas.workers.dev/',
    params={'url': 'https://openrouter.ai/api/v1/chat/completions'},
    headers=headers,
    json=data
)

print(response.json())
```

### POST Requests

```bash
curl -X POST "https://us-proxy.sonnenglas.workers.dev/?url=https://api.example.com/endpoint" \
  -H "Authorization: Bearer HhkNhaAu4fAKysAFJ0nHed6TX9qEwKlKk/nqlcyE0c4=" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

## Cloudflare Workers Free Tier

- **100,000 requests per day** (resets at midnight UTC)
- **Up to 100 workers** per account
- **Always free** - no credit card required

### What happens when you exceed the limit?

Requests will return errors until the daily reset at midnight UTC.

### Paid Plan

If you need more:
- **$5/month** for Workers Paid plan
- **10 million requests/month** included
- **$0.30** per additional million requests

## Deployment

### Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed
- Cloudflare account (free tier works fine)

### Deploy Your Own

1. Clone this repository:
   ```bash
   git clone https://github.com/stefanneubig/cloudflare-worker-proxy.git
   cd cloudflare-worker-proxy
   ```

2. Authenticate with Cloudflare:
   ```bash
   wrangler login
   ```

3. Generate your own token:
   ```bash
   openssl rand -base64 32
   ```

4. Update the token in `src/index.js`:
   ```javascript
   const BEARER_TOKEN = 'YOUR_NEW_TOKEN_HERE';
   ```

5. Update the worker name in `wrangler.toml` (optional):
   ```toml
   name = "your-proxy-name"
   ```

6. Deploy:
   ```bash
   wrangler deploy
   ```

7. Your proxy will be available at:
   ```
   https://your-proxy-name.YOUR_SUBDOMAIN.workers.dev
   ```

## Configuration

### wrangler.toml

```toml
name = "us-proxy"
main = "src/index.js"
compatibility_date = "2025-12-12"

[placement]
mode = "smart"
```

- **name**: Your worker's name
- **main**: Entry point file
- **compatibility_date**: Cloudflare Workers compatibility date
- **placement.mode**: "smart" routes requests to optimal data centers

## Security Considerations

1. **Keep your token secret** - Never commit tokens to public repositories
2. **Use environment variables** - For production, use Wrangler secrets:
   ```bash
   wrangler secret put BEARER_TOKEN
   ```
   Then update the code:
   ```javascript
   const BEARER_TOKEN = env.BEARER_TOKEN;
   ```

3. **Rotate tokens regularly** - Change your token periodically
4. **Monitor usage** - Check your Cloudflare dashboard for unusual activity

## Troubleshooting

### 401 Unauthorized

- Check that you're sending the `Authorization` header
- Verify the token matches the one in `src/index.js`
- Ensure the header format is: `Authorization: Bearer YOUR_TOKEN`

### Target API Returns 401

- Make sure you're using `X-Target-Authorization` for the target API's key
- Verify the target API key is valid
- Check that the header format is correct (usually `Bearer TOKEN`)

### CORS Errors

The proxy allows all origins by default. If you need to restrict:

```javascript
proxyResponse.headers.set('Access-Control-Allow-Origin', 'https://your-domain.com');
```

## License

MIT License - feel free to use and modify for your own purposes.

## Credits

Built with [Cloudflare Workers](https://workers.cloudflare.com/) and [Wrangler](https://developers.cloudflare.com/workers/wrangler/).
