# Patas Unidas Web

Versão web independente do Patas Unidas. O frontend usa a API Laravel com sessão para autenticação e consulta os animais persistidos no MySQL.

## Organização

- `frontend/`: React, TypeScript e Vite; `src/features` para funcionalidades e `src/shared` para componentes e integração REST. `src/app` contém a composição da aplicação; `src/styles` centraliza estilos.
- `backend/`: Laravel com endpoints de usuários e sessão, Sanctum e MySQL isolado. A documentação do fluxo de autenticação está em `backend/README.md`.
- `docker-compose.yml`: apenas MySQL local, com volume e rede próprios. PHP e Vite executam no host.

## Requisitos

Docker e Docker Compose; PHP 8.3 a 8.5 com extensões exigidas pelo Laravel, incluindo PDO MySQL; Composer; Node.js 22.12+ e npm. As versões exatas estão nos arquivos de lock. Exemplos de credenciais são exclusivos para desenvolvimento local.

## Primeira execução

Na raiz do projeto:

```sh
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Altere as senhas locais e mantenha MYSQL_PASSWORD e DB_PASSWORD iguais.
docker compose up -d --wait
cd backend
composer install
php artisan key:generate
php artisan migrate
```

Em outro terminal, para o backend:

```sh
cd backend
php artisan serve --host=127.0.0.1 --port=8001
```

Em outro terminal, para o frontend:

```sh
cd frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Acesse `http://127.0.0.1:5174`. A API fica em `http://127.0.0.1:8001/api/v1`; `VITE_API_BASE_URL` configura o endereço da API. Use o mesmo hostname no frontend e na API para que os cookies de sessão e CSRF funcionem. O endpoint de saúde do Laravel é `http://127.0.0.1:8001/up`.

O MySQL fica em `127.0.0.1:3309` por padrão, com banco e usuário próprios. A alteração de credenciais no `.env` do Compose após a criação do volume não altera usuários já inicializados no MySQL. Para parar sem apagar os dados: `docker compose down`. Não use as credenciais de exemplo em produção.

## Validação

```sh
cd frontend && npm run build && npm run lint
cd ../backend && php artisan test
```
