# Deploying

The site is one self-contained `dist/index.html` — no build step on the server, no runtime, no
database. `dist/` is committed to this repo, so the server only needs `git` and a web server.

---

## First time

```sh
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/anqoVoube/ashhobod.git
```

**Debian / Ubuntu:**

```sh
sudo cp /var/www/ashhobod/deploy/nginx.conf /etc/nginx/sites-available/ashhobod
sudo ln -s /etc/nginx/sites-available/ashhobod /etc/nginx/sites-enabled/ashhobod
sudo nano /etc/nginx/sites-available/ashhobod        # set server_name to your domain
sudo nginx -t && sudo systemctl reload nginx
```

**RHEL / Alma / Rocky:**

```sh
sudo cp /var/www/ashhobod/deploy/nginx.conf /etc/nginx/conf.d/ashhobod.conf
sudo nano /etc/nginx/conf.d/ashhobod.conf            # set server_name to your domain
sudo nginx -t && sudo systemctl reload nginx
```

Make sure nginx can read the files:

```sh
sudo chown -R www-data:www-data /var/www/ashhobod    # nginx:nginx on RHEL
```

## HTTPS

```sh
sudo certbot --nginx -d ashxobod.uz -d www.ashxobod.uz
```

Certbot rewrites the server block in place and sets up renewal. Nothing else to change.

## Updating

```sh
cd /var/www/ashhobod && sudo git pull
```

That's it — nginx picks up the new file immediately, and `Cache-Control: must-revalidate` on
`index.html` means visitors get the new build on their next load rather than a stale cached one.

---

## Set the domain in the social-card tags

`SITE_URL` at the top of `build.py` is empty. Until you set it, sharing the link in Telegram shows
the title and description but **no preview image**. Once the domain is live, on your laptop:

```sh
cd ashxobod-prototype
# edit build.py:  SITE_URL = "https://ashxobod.uz"
python3 build.py
git add -A && git commit -m "set site url" && git push
```

then `git pull` on the server.

---

## Testing without nginx

Serve `dist/` on any port to check it works:

```sh
cd /var/www/ashhobod && python3 -m http.server 8080 --directory dist
```

Then open `http://<server-ip>:8080`. Stop with Ctrl-C. Don't leave this running as your real
server — no HTTPS, no caching, single-threaded.

## Docker, if you'd rather

```sh
cd /var/www/ashhobod
docker run -d --name ashhobod --restart unless-stopped -p 8080:80 \
  -v "$PWD/dist:/usr/share/nginx/html:ro" nginx:alpine
```

Update with `git pull && docker restart ashhobod`. Put your existing reverse proxy in front of
port 8080 for HTTPS.

---

## Two deliberate choices worth knowing about

**Search engines are blocked** — `robots.txt`, a `<meta name="robots">` tag, and the
`X-Robots-Tag` header. This is a prototype for a business that exists, with a booking flow that
does not really book anything. It must not appear in search results where the park's actual
customers could find it and try to reserve a kart. Remove all three only if the park adopts this
as their real site.

**The footer says "Prototip · dizayn namunasi".** Leave it until the park has signed off — it is
what stops a stray visitor mistaking the page for the official site.
