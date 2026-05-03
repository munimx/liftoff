/**
 * Auto-generated Dockerfile for Laravel apps.
 */
export const LARAVEL_DOCKERFILE = `FROM php:8.3-apache
RUN docker-php-ext-install pdo pdo_mysql
WORKDIR /var/www/html
COPY . .
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
RUN composer install --no-dev --optimize-autoloader
RUN chown -R www-data:www-data storage bootstrap/cache
EXPOSE 80
CMD ["apache2-foreground"]
`;
