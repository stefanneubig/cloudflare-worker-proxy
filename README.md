# US Proxy (Hetzner VPS)

A simple HTTP proxy running on a US-based Hetzner VPS for routing requests through a US IP address.

## Setup

Runs as a Docker container with Nginx reverse proxy and Let's Encrypt SSL.

### Files

- `server.js` - Express proxy server
- `Dockerfile` - Container build instructions  
- `docker-compose.yml` - Container orchestration
- `package.json` - Node.js dependencies

### Management

```bash
# View logs
sudo docker logs us-proxy -f

# Restart
sudo docker restart us-proxy

# Rebuild after changes
cd /opt/us-proxy && sudo docker compose up -d --build
```

## Usage

```bash
# Basic request
curl "https://proxy-us.sgl.as/?url=https://api.example.com" \
  -H "Authorization: Bearer YOUR_TOKEN"

# With target API auth
curl "https://proxy-us.sgl.as/?url=https://api.example.com" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Target-Authorization: Bearer TARGET_API_KEY"
```

## Security

- Bearer token authentication required
- Runs as non-root user inside container
- Only listens on localhost (Nginx handles external traffic)
