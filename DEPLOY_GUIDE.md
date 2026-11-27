# راهنمای کامل نصب و اجرای «قلاب» روی سرور مجازی (VPS)

این راهنما به شما کمک می‌کند سیستم **«قلاب»** را از صفر روی یک سرور مجازی لینوکس (**Ubuntu 22.04 / 24.04** یا **Debian 12**) به صورت پایدار و ۲۴ ساعته راه‌اندازی کنید — هم **با دامنه و SSL رایگان (پیشنهادی برای نصب اپلیکیشن PWA)** و هم **بدون دامنه و مستقیم روی IP سرور**.

---

## پیش‌نیازهای سخت‌افزاری و نرم‌افزاری سرور

- **سیستم‌عامل:** Ubuntu 22.04 یا Ubuntu 24.04 LTS (یا Debian 12)
- **منابع پیشنهادی:** حداقل ۱ هسته CPU، رم ۱ تا ۲ گیگابایت، و فضای دیسک ۲۰ گیگابایت به بالا (برای نگهداری فایل‌های صوتی سمینارها)
- **نسخه Node.js:** **حتماً نسخه 22 یا بالاتر** (چون «قلاب» از موتور دیتابیس داخلی `node:sqlite` در Node 22 استفاده می‌کند و نیازی به نصب دیتابیس جداگانه ندارد)
- **نکته درباره اینترنت سرور:** اگر سرور داخل ایران است و می‌خواهید به **GapGPT** متصل شوید مشکلی نیست؛ اگر قصد اتصال مستقیم به **Gemini / OpenAI** یا **ربات تلگرام** را دارید، بهتر است سرور خارج از ایران باشد.

---

## بخش اول: مراحل مشترک نصب روی سرور (هم برای دامنه، هم برای IP)

### ۱. اتصال به سرور با SSH
در ترمینال کامپیوتر خود (یا PowerShell در ویندوز) دستور زیر را بزنید و جای `YOUR_SERVER_IP` آی‌پی سرور خود را بگذارید:

```bash
ssh root@YOUR_SERVER_IP
```

### ۲. آپدیت سیستم و نصب ابزارهای پایه
```bash
apt update && apt upgrade -y
apt install -y curl git build-essential ufw nginx
```

### ۳. نصب Node.js نسخه 22 (الزامی)
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
```

مطمئن شوید نسخه Node.js برابر با `v22.x` یا بالاتر است:
```bash
node -v
npm -v
```

### ۴. نصب PM2 (برای اجرای دائمی و ری‌استارت خودکار پس از ریبوت سرور)
```bash
npm install -g pm2
```

### ۵. دانلود (Clone) سورس پروژه «قلاب» روی سرور
پروژه را در مسیر `/var/www/gholab` قرار می‌دهیم:

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/Cipher-X-Coding/test.git gholab
cd /var/www/gholab
```

> **نکته:** اگر روی برنچ خاصی کار کرده‌اید (یا ریپازیتوری شما خصوصی است)، قبل از نصب پکیج‌ها به همان برنچ بروید:
> ```bash
> git checkout main
> ```
> همچنین می‌توانید به جای Git، فایل زیپ پروژه را با SCP/SFTP به `/var/www/gholab` آپلود و اکسترکت کنید.

### ۶. نصب پکیج‌ها و بیلد نسخه نهایی (Production)
```bash
cd /var/www/gholab
npm install
npm run build
```

بعد از اجرای `npm run build` پوشه `dist/` ساخته می‌شود که شامل نسخه بهینه‌شده فرانت‌اند، آیکون‌ها و فایل‌های PWA است.

### ۷. اجرای دائمی «قلاب» با PM2 روی پورت 3000
یک فایل تنظیمات برای PM2 می‌سازیم تا همواره با `NODE_ENV=production` اجرا شود:

```bash
cat << 'EOF' > /var/www/gholab/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'gholab',
      cwd: '/var/www/gholab',
      script: './node_modules/.bin/tsx',
      args: 'server/index.ts',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '700M',
    },
  ],
};
EOF
```

سپس برنامه را با PM2 اجرا و برای بوت خودکار سرور ثبت کنید:
```bash
cd /var/www/gholab
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```
*(اگر دستور `pm2 startup` یک خط دستور جدید به شما نشان داد، همان خط را کپی و اجرا کنید و دوباره `pm2 save` بزنید.)*

### ۸. تست داخلی اجرای سرور
```bash
curl -s http://127.0.0.1:3000/api/health
```
خروجی باید دقیقاً این باشد:
```json
{"ok":true,"service":"gholab-api"}
```

تا اینجا هسته «قلاب» روی سرور زنده و فعال است. حالا بر اساس اینکه **دامنه دارید** یا **فقط IP سرور دارید**، یکی از دو بخش زیر را انجام دهید.

---

## بخش دوم: راه‌اندازی با دامنه + HTTPS رایگان (پیشنهادی برای PWA)

اگر دامنه دارید (مثلاً `gholab.example.com` یا `example.com`)، این بهترین روش است؛ چون **نصب اپلیکیشن PWA روی آیفون، اندروید و دسکتاپ** بدون مشکل فعال می‌شود و تمام فایل‌های صوتی و API کلیدهای شما رمزنگاری (HTTPS) می‌شوند.

### ۱. تنظیم DNS دامنه
در پنل دامنه یا کلودفلر، یک رکورد **A** بسازید:
- **Type:** `A`
- **Name:** `@` (برای دامنه اصلی) یا `app` / `gholab` (برای ساب‌دامین)
- **IPv4 address:** آی‌پی سرور مجازی شما (`YOUR_SERVER_IP`)
- *(اگر از کلودفلر استفاده می‌کنید، در مرحله گرفتن SSL ابتدا ابر نارنجی Proxy را خاموش/خاکستری بگذارید تا Certbot بتواند گواهی بگیرد.)*

### ۲. ساخت کانفیگ Nginx برای دامنه
در دستور زیر، هر دو جای `YOUR_DOMAIN.COM` را با دامنه واقعی خود عوض کنید:

```bash
cat << 'EOF' > /etc/nginx/sites-available/gholab
server {
    listen 80;
    server_name YOUR_DOMAIN.COM;

    # اجازه آپلود فایل‌های صوتی سنگین سمینار تا 160 مگابایت
    client_max_body_size 160M;

    # افزایش زمان انتظار برای پردازش ویس‌های طولانی توسط هوش مصنوعی
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    send_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # استریم روان و پرش سریع روی موج صدا (Byte-Range Seeking)
        proxy_buffering off;
    }
}
EOF
```

فعال‌سازی سایت و بررسی صحت تنظیمات Nginx:
```bash
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/gholab /etc/nginx/sites-enabled/gholab
nginx -t
systemctl reload nginx
```

### ۳. باز کردن فایروال (UFW)
```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

### ۴. دریافت گواهی SSL رایگان (HTTPS) با Certbot
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d YOUR_DOMAIN.COM --non-interactive --agree-tos -m your-email@example.com --redirect
```

تست تمدید خودکار SSL:
```bash
certbot renew --dry-run
```

**تمام!** حالا آدرس `https://YOUR_DOMAIN.COM` را در مرورگر گوشی یا کامپیوتر باز کنید:
- سایت با قفل سبز HTTPS باز می‌شود.
- دکمه **«نصب اپلیکیشن قلاب (PWA)»** در اندروید، ویندوز، مک و آیفون به‌صورت کامل کار می‌کند.

---

## بخش سوم: راه‌اندازی بدون دامنه (مستقیم روی IP سرور)

اگر دامنه ندارید، **سه روش** پیش روی شماست:

### روش الف (پیشنهادی بدون دامنه): اتصال با IP روی پورت 80 از طریق Nginx
در این حالت بدون نوشتن شماره پورت، مستقیم با `http://YOUR_SERVER_IP` وارد سیستم می‌شوید و محدودیت حجم آپلود و تایم‌اوت‌ها هم بهینه هستند.

```bash
cat << 'EOF' > /etc/nginx/sites-available/gholab-ip
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # اجازه آپلود ویس‌های سمینار تا 160 مگابایت
    client_max_body_size 160M;

    # تایم‌اوت کافی برای پیاده‌سازی و تحلیل فایل‌های صوتی طولانی
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    send_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_buffering off;
    }
}
EOF
```

فعال‌سازی کانفیگ و باز کردن پورت ۸۰:
```bash
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/gholab-ip /etc/nginx/sites-enabled/gholab-ip
nginx -t
systemctl reload nginx

ufw allow OpenSSH
ufw allow 80/tcp
ufw --force enable
```

حالا در مرورگر وارد شوید:
```text
http://YOUR_SERVER_IP
```

---

### روش ب (سریع‌ترین روش بدون Nginx): اجرا مستقیم روی IP و پورت 3000
اگر اصلاً نمی‌خواهید Nginx تنظیم کنید، چون سرور «قلاب» خودش فایل‌های استاتیک و فرانت‌اند را مستقیم روی `0.0.0.0:3000` سرو می‌کند، کافیست پورت `3000` را در فایروال باز کنید:

```bash
ufw allow OpenSSH
ufw allow 3000/tcp
ufw --force enable
```

و مستقیم این آدرس را باز کنید:
```text
http://YOUR_SERVER_IP:3000
```

---

### نکته بسیار مهم درباره PWA روی IP (و ترفند طلایی HTTPS رایگان بدون خرید دامنه!)

> **محدودیت مرورگرها روی HTTP:** تمام قابلیت‌های «قلاب» روی `http://YOUR_SERVER_IP` بدون مشکل کار می‌کنند، **اما** مرورگرهای موبایل و دسکتاپ (Chrome / Safari / Edge) به دلایل امنیتی فقط روی آدرس‌های **HTTPS** اجازه ثبت Service Worker و **نصب اپلیکیشن PWA** را می‌دهند.

**ترفند رایگان بدون خرید دامنه (`sslip.io`):**
اگر نمی‌خواهید دامنه بخرید ولی می‌خواهید **HTTPS واقعی + نصب اپلیکیشن PWA روی گوشی** داشته باشید، می‌توانید از سرویس رایگان `sslip.io` استفاده کنید! کافیست نقطه‌های IP سرور خود را با خط تیره عوض کنید؛ مثلاً اگر IP سرور شما `185.10.20.30` است، آدرس رایگان شما بدون هیچ تنظیم DNS به شکل زیر خواهد بود:

```text
185-10-20-30.sslip.io
```

حالا دقیقاً همان **بخش دوم** را اجرا کنید و به جای `YOUR_DOMAIN.COM` آدرس `185-10-20-30.sslip.io` را بگذارید و دستور Certbot را بزنید:
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d 185-10-20-30.sslip.io --non-interactive --agree-tos -m your-email@example.com --redirect
```
به همین سادگی بدون خرید دامنه، هم **HTTPS معتبر** دارید هم **نصب کامل PWA روی آیفون، اندروید و کامپیوتر**!

---

## بخش چهارم: نگهداری، آپدیت و بکاپ‌گیری اطلاعات

### ۱. مسیرهای حیاتی برای بکاپ‌گیری
تمام اطلاعات پروژه‌ها، تنظیمات API، سناریوها و فایل‌های صوتی آپلودشده در پوشه `data/` ذخیره می‌شوند:
- `/var/www/gholab/data/sedagholab.db` → فایل دیتابیس SQLite
- `/var/www/gholab/data/uploads/` → فایل‌های صوتی آپلودشده

برای گرفتن یک فایل بکاپ فشرده از کل داده‌ها:
```bash
tar -czvf /root/gholab-backup-$(date +%F).tar.gz /var/www/gholab/data
```

### ۲. دستورات پرکاربرد مدیریت سرویس (PM2)
```bash
# مشاهده وضعیت اجرا و مصرف رم
pm2 status

# مشاهده لاگ‌های زنده سرور (برای عیب‌یابی خطاهای API یا تلگرام)
pm2 logs gholab

# ری‌استارت کردن برنامه
pm2 restart gholab

# توقف برنامه
pm2 stop gholab
```

### ۳. نحوه آپدیت کردن «قلاب» به نسخه‌های جدید (بدون از دست رفتن اطلاعات)
پوشه `data/` (شامل دیتابیس و ویس‌ها) در Git ذخیره نمی‌شود، بنابراین با آپدیت کد، پروژه‌ها و ویس‌های شما پاک نمی‌شوند:

```bash
cd /var/www/gholab
git pull
npm install
npm run build
pm2 restart gholab
```

---

## بخش پنجم: عیب‌یابی سریع (Troubleshooting)

| مشکل | علت احتمالی | راه‌حل |
|---|---|---|
| خطای `Cannot find module 'node:sqlite'` | نسخه Node.js سرور کمتر از 22 است | بررسی با `node -v` و نصب Node 22 طبق مرحله ۳ بخش اول |
| خطای `413 Request Entity Too Large` هنگام آپلود ویس | محدودیت پیش‌فرض آپلود در Nginx | بررسی وجود `client_max_body_size 160M;` در کانفیگ Nginx و اجرای `systemctl reload nginx` |
| خطای `504 Gateway Time-out` هنگام پردازش ویس طولانی | تمام شدن زمان انتظار پیش‌فرض ۶۰ ثانیه‌ای Nginx | بررسی وجود `proxy_read_timeout 300s;` در کانفیگ Nginx و اجرای `systemctl reload nginx` |
| دکمه نصب PWA مستقیم ظاهر نمی‌شود | باز کردن سایت با `http://IP` به جای `https://` | اتصال دامنه یا استفاده از ترفند رایگان `sslip.io` + Certbot |
| سایت باز نمی‌شود (`Connection Refused`) | بسته بودن فایروال یا توقف PM2 | بررسی `pm2 status`، `ufw status` و تست `curl http://127.0.0.1:3000/api/health` |
