#!/bin/sh
set -eu
mkdir -p /app/storage/app/private /app/storage/framework/cache/data /app/storage/framework/sessions /app/storage/framework/views /app/storage/logs /app/bootstrap/cache
chown -R www-data:www-data /app/storage /app/bootstrap/cache
php artisan migrate --force
rm -f /etc/apache2/mods-enabled/mpm_event.load /etc/apache2/mods-enabled/mpm_event.conf /etc/apache2/mods-enabled/mpm_worker.load /etc/apache2/mods-enabled/mpm_worker.conf
sed -i "s/Listen 80/Listen ${PORT:-8080}/" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \*:80>/<VirtualHost *:${PORT:-8080}>/" /etc/apache2/sites-available/000-default.conf
exec apache2-foreground
