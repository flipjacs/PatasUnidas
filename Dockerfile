FROM node:22-bookworm-slim AS frontend
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_BASE_URL
RUN npm run build

FROM composer:2 AS composer
FROM php:8.5-apache-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libzip-dev libonig-dev libicu-dev unzip \
    && docker-php-ext-install pdo_mysql mbstring zip intl \
    && a2dismod mpm_event mpm_worker \
    && a2enmod mpm_prefork rewrite headers remoteip \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer /usr/bin/composer /usr/bin/composer
WORKDIR /app
COPY backend/ ./
RUN composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader \
    && mkdir -p storage/app/private storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache
COPY --from=frontend /src/frontend/dist/ /app/public/
COPY deploy/railway.htaccess /app/public/.htaccess
COPY deploy/railway-start.sh /usr/local/bin/patas-start
RUN chmod +x /usr/local/bin/patas-start \
    && sed -i 's!/var/www/html!/app/public!g' /etc/apache2/sites-available/000-default.conf /etc/apache2/apache2.conf \
    && printf '<Directory /app/public>\nOptions FollowSymLinks\nAllowOverride All\nRequire all granted\n</Directory>\n' > /etc/apache2/conf-available/patas.conf \
    && a2enconf patas
CMD ["patas-start"]
