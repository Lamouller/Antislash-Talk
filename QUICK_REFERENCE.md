# 🚀 Quick Reference - Antislash Talk

One-line commands for common operations.

## 📦 Initial Deployment

### Deploy Complete Stack on VPS
```bash
curl -sSL https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/deploy-vps-final.sh | bash
```

## 🌐 Domain Management

### Add Custom Domain to Existing Deployment
```bash
cd ~/antislash-talk && curl -sSL https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/add-domain.sh -o add-domain.sh && chmod +x add-domain.sh && ./add-domain.sh
```

### Fix Everything (Auth, SSL, DB, Studio, Web) - One Command
```bash
cd ~/antislash-talk && curl -sSL https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/fix-everything.sh -o fix-everything.sh && chmod +x fix-everything.sh && sudo ./fix-everything.sh
```

### Fix Auth + SSL After Domain Change (One Command)
```bash
cd ~/antislash-talk && curl -sSL https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/fix-auth-after-domain.sh -o fix-auth.sh && chmod +x fix-auth.sh && sudo ./fix-auth.sh
```

### Fix Studio Only (Can't Create Users, 400/403 Errors)
```bash
cd ~/antislash-talk && curl -sSL https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/fix-studio-complete.sh -o fix-studio-complete.sh && chmod +x fix-studio-complete.sh && ./fix-studio-complete.sh
```

### Switch to Single Port 443 (If Ports 8443-8445 Blocked)
```bash
cd ~/antislash-talk && curl -sSL https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/fix-single-port-443.sh -o fix-single-port-443.sh && chmod +x fix-single-port-443.sh && sudo ./fix-single-port-443.sh
```

### Install Let's Encrypt SSL (Ports Mode)
```bash
sudo certbot --nginx -d yourdomain.com
```

### Install Let's Encrypt SSL (Subdomains Mode)
```bash
sudo certbot --nginx -d app.yourdomain.com -d api.yourdomain.com -d studio.yourdomain.com -d ollama.yourdomain.com
```

## 🔄 Service Management

### Restart All Services
```bash
cd ~/antislash-talk && docker compose -f docker-compose.monorepo.yml restart
```

### Rebuild and Restart Web App
```bash
cd ~/antislash-talk && docker compose -f docker-compose.monorepo.yml build web && docker compose -f docker-compose.monorepo.yml up -d
```

### View Logs (All Services)
```bash
cd ~/antislash-talk && docker compose -f docker-compose.monorepo.yml logs -f
```

### View Logs (Web App Only)
```bash
cd ~/antislash-talk && docker compose -f docker-compose.monorepo.yml logs -f web
```

### Stop All Services
```bash
cd ~/antislash-talk && docker compose -f docker-compose.monorepo.yml down
```

### Start All Services
```bash
cd ~/antislash-talk && docker compose -f docker-compose.monorepo.yml up -d
```

## 🔍 Diagnostics

### Run Full Authentication Diagnostic
```bash
cd ~/antislash-talk && curl -sSL https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/diagnose-auth-complete.sh -o diagnose-auth-complete.sh && chmod +x diagnose-auth-complete.sh && ./diagnose-auth-complete.sh
```

### Run Studio Diagnostic (Create User Issues)
```bash
cd ~/antislash-talk && curl -sSL https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/diagnose-studio.sh -o diagnose-studio.sh && chmod +x diagnose-studio.sh && ./diagnose-studio.sh
```

### Run Complete Deployment Diagnostic
```bash
cd ~/antislash-talk && curl -sSL https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/diagnose-deployment.sh -o diagnose-deployment.sh && chmod +x diagnose-deployment.sh && ./diagnose-deployment.sh
```

### Check All Services Status
```bash
cd ~/antislash-talk && docker compose -f docker-compose.monorepo.yml ps
```

### Test Nginx Configuration
```bash
sudo nginx -t
```

### Check Nginx Status
```bash
sudo systemctl status nginx
```

### View Nginx Error Logs
```bash
sudo tail -f /var/log/nginx/error.log
```

### Check DNS Resolution
```bash
host yourdomain.com
```

### Check Server IP
```bash
curl ifconfig.me
```

### Test Services Connectivity
```bash
curl -k https://yourdomain.com/ && echo "✅ App OK" || echo "❌ App Failed"
curl -k https://yourdomain.com:8443/ && echo "✅ API OK" || echo "❌ API Failed"
curl -k https://yourdomain.com:8444/ && echo "✅ Studio OK" || echo "❌ Studio Failed"
curl -k https://yourdomain.com:8445/ && echo "✅ Ollama OK" || echo "❌ Ollama Failed"
```

## 🔐 SSL Management

### Check SSL Certificates
```bash
sudo certbot certificates
```

### Renew SSL Certificates
```bash
sudo certbot renew
```

### Test SSL Renewal
```bash
sudo certbot renew --dry-run
```

## 🔥 Firewall

### Open Required Ports (Ports Mode)
```bash
sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 8443/tcp && sudo ufw allow 8444/tcp && sudo ufw allow 8445/tcp && sudo ufw status
```

### Open Required Ports (Subdomains Mode)
```bash
sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw status
```

### Check Firewall Status
```bash
sudo ufw status verbose
```

## 💾 Backup & Restore

### Backup Configuration
```bash
cd ~/antislash-talk && cp .env.monorepo ".env.monorepo.backup.$(date +%Y%m%d_%H%M%S)" && sudo cp /etc/nginx/sites-available/antislash-talk-ssl "/etc/nginx/sites-available/antislash-talk-ssl.backup.$(date +%Y%m%d_%H%M%S)" && echo "✅ Backup complete"
```

### List Backups
```bash
ls -lh ~/antislash-talk/*.backup.* && sudo ls -lh /etc/nginx/sites-available/*.backup.*
```

## 🔧 Configuration

### Edit Environment Variables
```bash
nano ~/antislash-talk/.env.monorepo
```

### Edit Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/antislash-talk-ssl
```

### Reload Nginx After Config Change
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Update URLs After Domain Change
```bash
cd ~/antislash-talk && export VITE_SUPABASE_URL="https://yourdomain.com:8443" && docker compose -f docker-compose.monorepo.yml build web && docker compose -f docker-compose.monorepo.yml up -d
```

## 🗄️ Database

### Access PostgreSQL
```bash
docker exec -it antislash-talk-db psql -U supabase_admin postgres
```

### Backup Database
```bash
docker exec antislash-talk-db pg_dump -U supabase_admin postgres > "backup_$(date +%Y%m%d_%H%M%S).sql"
```

### View Database Logs
```bash
docker logs antislash-talk-db -f
```

## 🤖 Ollama

### Check Ollama Status
```bash
docker exec antislash-talk-ollama ollama list
```

### Pull New Model
```bash
docker exec antislash-talk-ollama ollama pull llama3.2:3b
```

### Test Ollama API
```bash
curl -k https://yourdomain.com:8445/api/tags
```

## 🧹 Maintenance

### Clean Docker System
```bash
docker system prune -f
```

### Clean Docker Volumes (DANGER - removes data)
```bash
docker system prune -a --volumes
```

### Update Application from Git
```bash
cd ~/antislash-talk && git pull && docker compose -f docker-compose.monorepo.yml build && docker compose -f docker-compose.monorepo.yml up -d
```

### Restart Server
```bash
sudo reboot
```

## 📊 Monitoring

### Check Disk Usage
```bash
df -h
```

### Check Memory Usage
```bash
free -h
```

### Check Docker Resources
```bash
docker stats
```

### Check System Load
```bash
uptime && top -bn1 | head -20
```

## 🆘 Emergency Recovery

### Restore from Backup
```bash
cd ~/antislash-talk && cp .env.monorepo.backup.YYYYMMDD_HHMMSS .env.monorepo && sudo cp /etc/nginx/sites-available/antislash-talk-ssl.backup.YYYYMMDD_HHMMSS /etc/nginx/sites-available/antislash-talk-ssl && sudo nginx -t && sudo systemctl reload nginx && docker compose -f docker-compose.monorepo.yml build web && docker compose -f docker-compose.monorepo.yml up -d
```

### Nuclear Restart (stops and restarts everything)
```bash
cd ~/antislash-talk && docker compose -f docker-compose.monorepo.yml down && docker compose -f docker-compose.monorepo.yml up -d && sudo systemctl restart nginx
```

### Check Everything Status
```bash
echo "=== Docker Services ===" && docker compose -f ~/antislash-talk/docker-compose.monorepo.yml ps && echo -e "\n=== Nginx ===" && sudo systemctl status nginx --no-pager && echo -e "\n=== Firewall ===" && sudo ufw status && echo -e "\n=== Disk Space ===" && df -h / && echo -e "\n=== Memory ===" && free -h
```

---

## 📖 Full Documentation

- **Complete Setup**: [README.md](README.md)
- **Domain Configuration**: [docs/DOMAIN_CONFIGURATION.md](docs/DOMAIN_CONFIGURATION.md)
- **All Scripts**: [SCRIPTS.md](SCRIPTS.md)
- **Client Deployment**: [docs/CLIENT_DEPLOYMENT.md](docs/CLIENT_DEPLOYMENT.md)

---

**Built with ❤️ by Antislash Studio**

