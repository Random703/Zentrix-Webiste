# Deploying Zentrix to your VPS

The site in `site/` is plain static HTML/CSS/JS — no build step, no Node process required at runtime. It just needs to be served by a web server (nginx below).

## 1. One-time VPS setup

SSH into your VPS, then:

```bash
sudo apt update
sudo apt install -y nginx rsync
sudo mkdir -p /var/www/zentrix/site
sudo chown -R $USER:$USER /var/www/zentrix
```

Copy `deploy/nginx/zentrix.conf` to the server and enable it:

```bash
sudo cp zentrix.conf /etc/nginx/sites-available/zentrix.conf
sudo ln -s /etc/nginx/sites-available/zentrix.conf /etc/nginx/sites-enabled/zentrix.conf
sudo nginx -t
sudo systemctl reload nginx
```

Edit `server_name` in `zentrix.conf` to match your real domain before enabling it.

## 2. DNS

Point your domain's `A` record (and `www` if used) at the VPS's public IP address. Wait for propagation before requesting a certificate.

## 3. HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d zentrix.com -d www.zentrix.com
```

Certbot edits the nginx config to add the TLS server block and sets up auto-renewal.

## 4. Deploying / updating the site

From your local machine, run:

```bash
cd deploy
chmod +x deploy.sh
./deploy.sh youruser@your-vps-ip
```

This rsyncs `site/` to `/var/www/zentrix/site` on the server and reloads nginx. Run it again any time you change files locally — it only uploads what changed and removes files that no longer exist locally (`--delete`).

If your remote path differs from `/var/www/zentrix/site`, pass it as a second argument:

```bash
./deploy.sh youruser@your-vps-ip /var/www/zentrix/site
```

## Notes

- All asset paths in the HTML are relative (no leading `/`), so the site also works if served from a subdirectory.
- The contact form is UI-only — submitting it shows a success state locally in the browser but sends nothing anywhere. If you later want real submissions, wire the form in `site/contact.html` to a backend or a form service (e.g. Formspree) and remove the `preventDefault()` short-circuit in `site/js/main.js`.
