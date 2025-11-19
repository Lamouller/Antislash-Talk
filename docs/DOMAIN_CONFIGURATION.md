# 🌐 Domain Configuration Guide

Complete guide to adding and managing custom domains for Antislash Talk.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration Modes](#configuration-modes)
- [DNS Setup](#dns-setup)
- [SSL Certificates](#ssl-certificates)
- [Troubleshooting](#troubleshooting)
- [Manual Configuration](#manual-configuration)

## Prerequisites

Before adding a domain, ensure:

- ✅ You have deployed Antislash Talk using `deploy-vps-final.sh`
- ✅ Your application is running and accessible via IP
- ✅ You own a domain name
- ✅ You have access to your domain's DNS settings

## Quick Start

### One-Command Domain Setup

```bash
cd ~/antislash-talk
curl -sSL https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/add-domain.sh -o add-domain.sh
chmod +x add-domain.sh
./add-domain.sh
```

The script will:
1. Ask for your domain name
2. Let you choose between ports or subdomains mode
3. Backup existing configuration
4. Update Nginx configuration
5. Update environment variables
6. Rebuild the application
7. Test all services
8. Optionally install Let's Encrypt certificates

## Configuration Modes

### Mode 1: Ports (Recommended)

**Best for:** Simple setup, single domain

**Advantages:**
- ✅ Only one DNS record needed
- ✅ Faster to configure
- ✅ Easier to manage
- ✅ Works immediately after DNS propagation

**URLs structure:**
```
Application:  https://yourdomain.com/
API:          https://yourdomain.com:8443/
Studio:       https://yourdomain.com:8444/
Ollama:       https://yourdomain.com:8445/
```

**DNS configuration:**
```
Type: A
Name: @ (or yourdomain.com)
Value: YOUR_SERVER_IP
TTL: 300
```

**Firewall ports to open:**
```bash
sudo ufw allow 443/tcp   # Application
sudo ufw allow 8443/tcp  # API
sudo ufw allow 8444/tcp  # Studio
sudo ufw allow 8445/tcp  # Ollama
```

---

### Mode 2: Subdomains

**Best for:** Professional appearance, enterprise deployments

**Advantages:**
- ✅ Clean URLs without ports
- ✅ Professional appearance
- ✅ Standard HTTPS port (443) for all services
- ✅ Easier to remember URLs

**URLs structure:**
```
Application:  https://app.yourdomain.com/
API:          https://api.yourdomain.com/
Studio:       https://studio.yourdomain.com/
Ollama:       https://ollama.yourdomain.com/
```

**DNS configuration (4 records needed):**
```
Type: A
Name: app
Value: YOUR_SERVER_IP
TTL: 300

Type: A
Name: api
Value: YOUR_SERVER_IP
TTL: 300

Type: A
Name: studio
Value: YOUR_SERVER_IP
TTL: 300

Type: A
Name: ollama
Value: YOUR_SERVER_IP
TTL: 300
```

**Firewall:**
```bash
sudo ufw allow 443/tcp   # All services on standard HTTPS
sudo ufw allow 80/tcp    # HTTP redirect
```

## DNS Setup

### Step-by-Step DNS Configuration

1. **Log into your domain registrar** (OVH, Cloudflare, GoDaddy, Namecheap, etc.)

2. **Navigate to DNS settings** (usually called "DNS Management", "DNS Zone", or "Advanced DNS")

3. **Find your server IP:**
   ```bash
   curl ifconfig.me
   ```

4. **Add DNS records** according to your chosen mode:

   **For Ports Mode:**
   ```
   Type: A
   Name: @ or leave blank for root domain
   Value: YOUR_SERVER_IP
   TTL: 300 (or auto)
   ```

   **For Subdomains Mode:**
   Add 4 A records as shown above

5. **Wait for DNS propagation** (usually 5-30 minutes, can take up to 24 hours)

6. **Verify DNS propagation:**
   ```bash
   # Check if domain resolves to your IP
   host yourdomain.com
   
   # Or use online tools
   # https://dnschecker.org
   ```

### DNS Providers Examples

#### Cloudflare
1. Go to Cloudflare dashboard
2. Select your domain
3. Click "DNS" tab
4. Click "Add record"
5. Fill in: Type=A, Name=@, IPv4=YOUR_IP
6. Set Proxy status to "DNS only" (grey cloud)

#### OVH
1. Go to OVH Control Panel
2. Select your domain
3. Click "DNS Zone"
4. Click "Add an entry"
5. Select "A" record
6. Enter your server IP

#### Namecheap
1. Go to Domain List
2. Click "Manage" next to your domain
3. Click "Advanced DNS"
4. Add new record: Type=A, Host=@, Value=YOUR_IP

## SSL Certificates

### Automatic SSL with Let's Encrypt

The script will offer to install Let's Encrypt certificates automatically.

**Manual installation later:**

**For Ports Mode:**
```bash
sudo certbot --nginx -d yourdomain.com
```

**For Subdomains Mode:**
```bash
sudo certbot --nginx \
  -d app.yourdomain.com \
  -d api.yourdomain.com \
  -d studio.yourdomain.com \
  -d ollama.yourdomain.com
```

### Automatic Renewal

Let's Encrypt certificates auto-renew. Verify:
```bash
# Test renewal
sudo certbot renew --dry-run

# Check renewal timer
sudo systemctl status certbot.timer

# Manual renewal if needed
sudo certbot renew
```

### Certificate Management

```bash
# List certificates
sudo certbot certificates

# Revoke a certificate
sudo certbot revoke --cert-name yourdomain.com

# Delete a certificate
sudo certbot delete --cert-name yourdomain.com
```

## Troubleshooting

### Domain Not Accessible

**Check DNS propagation:**
```bash
host yourdomain.com
dig yourdomain.com
nslookup yourdomain.com
```

**Check Nginx configuration:**
```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

**Check firewall:**
```bash
sudo ufw status
sudo ufw allow 443/tcp
sudo ufw allow 8443/tcp
sudo ufw allow 8444/tcp
sudo ufw allow 8445/tcp
```

---

### SSL Certificate Errors

**Let's Encrypt rate limits:**
- 50 certificates per week per domain
- 5 duplicate certificates per week

**If rate limited:**
```bash
# Use staging environment for testing
sudo certbot --nginx -d yourdomain.com --staging
```

**Certificate not working:**
```bash
# Check certificate details
sudo certbot certificates

# Test Nginx SSL
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

### Service Not Responding

**Check Docker containers:**
```bash
cd ~/antislash-talk
docker compose -f docker-compose.monorepo.yml ps
docker compose -f docker-compose.monorepo.yml logs -f web
```

**Rebuild if needed:**
```bash
cd ~/antislash-talk
docker compose -f docker-compose.monorepo.yml build web
docker compose -f docker-compose.monorepo.yml up -d
```

**Check environment variables:**
```bash
cat ~/antislash-talk/.env.monorepo | grep VITE_SUPABASE_URL
cat ~/antislash-talk/apps/web/.env
```

---

### Wrong URLs in Application

**Symptom:** Application trying to connect to old IP addresses

**Fix:**
```bash
cd ~/antislash-talk

# Update environment variables manually
nano .env.monorepo
# Update VITE_SUPABASE_URL and API_EXTERNAL_URL

nano apps/web/.env
# Update VITE_SUPABASE_URL

# Rebuild with new URLs
export VITE_SUPABASE_URL="https://yourdomain.com:8443"
docker compose -f docker-compose.monorepo.yml build web
docker compose -f docker-compose.monorepo.yml up -d
```

---

### CORS Errors

**Check Nginx configuration includes CORS headers:**
```bash
sudo cat /etc/nginx/sites-available/antislash-talk-ssl | grep -A 5 "Access-Control"
```

**Verify allowed origins in Supabase:**
```bash
# Check .env.monorepo
cat .env.monorepo | grep URI_ALLOW_LIST
```

## Manual Configuration

If you prefer to configure manually instead of using the script:

### 1. Backup Current Configuration

```bash
cd ~/antislash-talk
cp .env.monorepo .env.monorepo.backup
sudo cp /etc/nginx/sites-available/antislash-talk-ssl /etc/nginx/sites-available/antislash-talk-ssl.backup
```

### 2. Update Nginx Configuration

Edit `/etc/nginx/sites-available/antislash-talk-ssl`:

```bash
sudo nano /etc/nginx/sites-available/antislash-talk-ssl
```

Replace all `server_name _;` with `server_name yourdomain.com;`

Test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Update Environment Variables

```bash
cd ~/antislash-talk
nano .env.monorepo
```

Update these variables:
```env
VITE_SUPABASE_URL=https://yourdomain.com:8443
API_EXTERNAL_URL=https://yourdomain.com:8443
VITE_OLLAMA_URL=https://yourdomain.com:8445
```

### 4. Update Web App Environment

```bash
nano apps/web/.env
```

Update:
```env
VITE_SUPABASE_URL=https://yourdomain.com:8443
```

### 5. Rebuild Application

```bash
export VITE_SUPABASE_URL="https://yourdomain.com:8443"
export VITE_SUPABASE_ANON_KEY="your-anon-key"

docker compose -f docker-compose.monorepo.yml build \
  --build-arg VITE_SUPABASE_URL="${VITE_SUPABASE_URL}" \
  --build-arg VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY}" \
  web

docker compose -f docker-compose.monorepo.yml up -d
```

### 6. Test Services

```bash
curl -k https://yourdomain.com/
curl -k https://yourdomain.com:8443/
curl -k https://yourdomain.com:8444/
curl -k https://yourdomain.com:8445/
```

## Advanced Configuration

### Custom SSL Certificates

If you have your own SSL certificates:

```bash
# Place certificates
sudo cp your-cert.crt /etc/nginx/ssl/yourdomain.crt
sudo cp your-cert.key /etc/nginx/ssl/yourdomain.key

# Update Nginx
sudo nano /etc/nginx/sites-available/antislash-talk-ssl
# Change paths:
# ssl_certificate /etc/nginx/ssl/yourdomain.crt;
# ssl_certificate_key /etc/nginx/ssl/yourdomain.key;

# Reload
sudo nginx -t
sudo systemctl reload nginx
```

### Multiple Domains

To add multiple domains pointing to the same installation:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com otherdomain.com www.yourdomain.com;
    # ... rest of config
}
```

### Redirect www to non-www

```nginx
server {
    listen 443 ssl http2;
    server_name www.yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    
    return 301 https://yourdomain.com$request_uri;
}
```

## Backup and Restore

### Backup Configuration

```bash
cd ~/antislash-talk

# Backup script creates timestamped backups automatically
# Manual backup:
cp .env.monorepo ".env.monorepo.backup.$(date +%Y%m%d_%H%M%S)"
sudo cp /etc/nginx/sites-available/antislash-talk-ssl "/etc/nginx/sites-available/antislash-talk-ssl.backup.$(date +%Y%m%d_%H%M%S)"
```

### Restore from Backup

```bash
# List backups
ls -la *.backup.*
ls -la /etc/nginx/sites-available/*.backup.*

# Restore environment
cp .env.monorepo.backup.YYYYMMDD_HHMMSS .env.monorepo

# Restore Nginx
sudo cp /etc/nginx/sites-available/antislash-talk-ssl.backup.YYYYMMDD_HHMMSS /etc/nginx/sites-available/antislash-talk-ssl
sudo nginx -t
sudo systemctl reload nginx

# Rebuild
docker compose -f docker-compose.monorepo.yml build web
docker compose -f docker-compose.monorepo.yml up -d
```

## Useful Commands

```bash
# Check domain resolution
host yourdomain.com
dig yourdomain.com +short

# Test SSL certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Check certificate expiration
sudo certbot certificates

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Check Docker logs
docker compose -f docker-compose.monorepo.yml logs -f web

# Restart everything
docker compose -f docker-compose.monorepo.yml restart
sudo systemctl restart nginx
```

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review logs: `docker compose logs` and `/var/log/nginx/error.log`
3. Open an issue on GitHub with:
   - Domain configuration mode (ports/subdomains)
   - DNS provider
   - Error messages
   - Output of diagnostic commands

---

**Built with ❤️ by Antislash Studio**

