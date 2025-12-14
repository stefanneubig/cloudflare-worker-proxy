# Hetzner VPS Proxy Setup (Ubuntu)

## Prerequisites
- Ubuntu VPS with root/sudo access
- Domain: `proxy-us.sgl.as` pointing to VPS IP in Cloudflare DNS

---

## 1. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (process manager) and Nginx
sudo npm install -g pm2
sudo apt install -y nginx certbot python3-certbot-nginx

# Verify installations
node --version
pm2 --version
nginx -v
```

---

## 2. Create Proxy Application

```bash
# Create app directory
sudo mkdir -p /opt/us-proxy
cd /opt/us-proxy

# Create package.json
sudo tee package.json > /dev/null <<'EOF'
{
  "name": "us-proxy",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF

# Install dependencies
sudo npm install

# Create proxy server
sudo tee server.js > /dev/null <<'EOF'
import express from 'express';

const app = express();
const PORT = 3000;
const BEARER_TOKEN = 'HhkNhaAu4fAKysAFJ0nHed6TX9qEwKlKk/nqlcyE0c4=';

app.use(express.json());
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

    // Prepare headers
    const headers = { ...req.headers };
    delete headers.authorization;
    delete headers.host;
    delete headers['x-target-authorization'];

    // Add target auth if provided
    const targetAuth = req.headers['x-target-authorization'];
    if (targetAuth) {
      headers.authorization = targetAuth;
    }

    // Forward request
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    });

    // Copy response headers
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
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

app.listen(PORT, '127.0.0.1', () => {
  console.log(`US Proxy running on http://127.0.0.1:${PORT}`);
});
EOF

# Set permissions
sudo chown -R www-data:www-data /opt/us-proxy
```

---

## 3. Configure PM2 (Process Isolation)

```bash
# Start app with PM2
sudo pm2 start /opt/us-proxy/server.js --name us-proxy --user www-data

# Save PM2 config
sudo pm2 save

# Setup PM2 to start on boot
sudo pm2 startup systemd -u www-data --hp /var/www
sudo systemctl enable pm2-www-data

# Check status
sudo pm2 status
sudo pm2 logs us-proxy --lines 20
```

---

## 4. Configure Nginx Reverse Proxy

```bash
# Create Nginx config
sudo tee /etc/nginx/sites-available/us-proxy > /dev/null <<'EOF'
server {
    listen 80;
    server_name proxy-us.sgl.as;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout settings for long requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/us-proxy /etc/nginx/sites-enabled/

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. Setup SSL with Certbot (Cloudflare)

```bash
# Get SSL certificate (ensure DNS is already pointing to this VPS)
sudo certbot --nginx -d proxy-us.sgl.as --non-interactive --agree-tos --email your-email@example.com

# Certbot will automatically configure HTTPS and redirect HTTP to HTTPS

# Test auto-renewal
sudo certbot renew --dry-run
```

---

## 6. Cloudflare DNS Setup

**In Cloudflare Dashboard:**

1. Go to DNS settings for `sgl.as`
2. Add A record:
   - **Name:** `proxy-us`
   - **IPv4 address:** `YOUR_HETZNER_VPS_IP`
   - **Proxy status:** DNS only (grey cloud) ⚠️ **Important: Disable proxy**
   - **TTL:** Auto

**Why DNS only?** If you enable Cloudflare proxy (orange cloud), requests will route through Cloudflare's network and you'll lose the US IP benefit.

---

## 7. Firewall Configuration

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Verify firewall
sudo ufw status
```

---

## 8. Test the Proxy

```bash
# Test from VPS
curl "http://localhost:3000/?url=https://ipinfo.io/json" \
  -H "Authorization: Bearer HhkNhaAu4fAKysAFJ0nHed6TX9qEwKlKk/nqlcyE0c4="

# Test from outside (after DNS propagation)
curl "https://proxy-us.sgl.as/?url=https://ipinfo.io/json" \
  -H "Authorization: Bearer HhkNhaAu4fAKysAFJ0nHed6TX9qEwKlKk/nqlcyE0c4="

# Should show US location
```

---

## 9. Monitoring & Maintenance

```bash
# View logs
sudo pm2 logs us-proxy

# Restart proxy
sudo pm2 restart us-proxy

# Check status
sudo pm2 status

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 10. Change Bearer Token (Optional)

```bash
# Generate new token
openssl rand -base64 32

# Update server.js
sudo nano /opt/us-proxy/server.js
# Change the BEARER_TOKEN value

# Restart
sudo pm2 restart us-proxy
```

---

## Usage

**Endpoint:** `https://proxy-us.sgl.as`

**Basic request:**
```bash
curl "https://proxy-us.sgl.as/?url=https://api.example.com" \
  -H "Authorization: Bearer HhkNhaAu4fAKysAFJ0nHed6TX9qEwKlKk/nqlcyE0c4="
```

**With target API auth (OpenRouter, etc.):**
```bash
curl "https://proxy-us.sgl.as/?url=https://openrouter.ai/api/v1/chat/completions" \
  -H "Authorization: Bearer HhkNhaAu4fAKysAFJ0nHed6TX9qEwKlKk/nqlcyE0c4=" \
  -H "X-Target-Authorization: Bearer sk-or-v1-your-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-3.5-turbo","messages":[{"role":"user","content":"Hi"}]}'
```

---

## Troubleshooting

**PM2 won't start:**
```bash
sudo pm2 delete us-proxy
sudo pm2 start /opt/us-proxy/server.js --name us-proxy --user www-data
sudo pm2 save
```

**Nginx errors:**
```bash
sudo nginx -t
sudo systemctl status nginx
```

**SSL issues:**
```bash
sudo certbot renew --force-renewal
```

**DNS not resolving:**
- Wait 5-10 minutes for DNS propagation
- Verify A record in Cloudflare: `dig proxy-us.sgl.as`
- Ensure proxy status is "DNS only" (grey cloud)
