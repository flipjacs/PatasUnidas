# API Patas Unidas Web

A API usa MySQL próprio e autenticação de SPA por sessão Laravel com middleware stateful do Sanctum. O aplicativo React utiliza os endpoints de autenticação. Perfis no banco são armazenados em minúsculas e apresentados em maiúsculas na API.

## Iniciar localmente

Na raiz do projeto, configure `.env` e `backend/.env` a partir dos respectivos `.env.example` e mantenha as credenciais MySQL iguais. Depois execute:

```sh
docker compose up -d --wait
cd backend
composer install
php artisan key:generate
php artisan migrate
php artisan serve --host=127.0.0.1 --port=8001
```

`key:generate` é necessário apenas em uma instalação nova: não regenere a chave de um ambiente existente sem planejar o impacto sobre cookies e dados criptografados. O MySQL padrão deste projeto usa `127.0.0.1:3309` e `patas_unidas_web`; confira as variáveis antes de executar migrations. Não use as credenciais de exemplo em produção.

## Endpoints

- `GET /sanctum/csrf-cookie`: inicializa a sessão e o cookie CSRF.
- `POST /api/v1/usuarios/cadastro`: recebe `nome`, `email` e `senha`; cria somente `USUARIO` sem ONG.
- `POST /api/v1/auth/login`: recebe `email` e `senha`; devolve o usuário e cria uma sessão por cookie.
- `GET /api/v1/auth/me`: devolve o usuário da sessão.
- `POST /api/v1/auth/logout`: encerra a sessão.
- `POST /api/v1/usuarios/internos`: administrador ativo com ONG informa `nome`, `email`, `senha` e `perfil` (`VOLUNTARIO` ou `VETERINARIO`); a ONG vem da sessão.

Erros de validação retornam 400, e-mail duplicado 409, credenciais incorretas 401, permissão insuficiente 403 e excesso de tentativas 429. A senha deve ter 8 a 72 caracteres e no máximo 72 bytes, limite do BCrypt. Nenhuma resposta contém o hash.

Para uma SPA, use o mesmo hostname para frontend e API (por exemplo, `127.0.0.1` em ambos). Configure as origens em `SANCTUM_STATEFUL_DOMAINS` e `CORS_ALLOWED_ORIGINS`, incluindo portas. Envie `Accept: application/json`, `Origin` ou `Referer` da SPA, e credenciais em todas as requisições. Primeiro obtenha `/sanctum/csrf-cookie`; leia e decodifique o cookie `XSRF-TOKEN` e envie-o no cabeçalho `X-XSRF-TOKEN` para requisições que alterem dados. O cookie de sessão é HTTP-only; use HTTPS e `SESSION_SECURE_COOKIE=true` em produção, com `APP_DEBUG=false` e origens explícitas. Não armazene tokens em localStorage.

## Testes

```sh
php artisan test
```

O PHPUnit usa SQLite em memória, isolado do MySQL de desenvolvimento.

## Primeiro administrador e funcionários

O criador cadastra a ONG e cria seu primeiro administrador em `POST /api/v1/platform/ongs/{ong}/administradores`, enviando somente `nome` e `email`. A conta nasce inativa e a ONG permanece suspensa. No terminal administrativo local, execute `php artisan patas-unidas:convite-admin {id-do-usuario}` e entregue o token diretamente ao administrador; não o registre em arquivos ou mensagens públicas. O token é armazenado com hash na tabela padrão `password_reset_tokens` e expira conforme `config/auth.php`.

O administrador define a própria senha enviando `email`, `token` e `senha` para `POST /api/v1/auth/primeiro-acesso`. Após isso, o criador pode reativar a ONG. Administradores de ONGs ativas consultam e ativam/desativam voluntários e veterinários por `/api/v1/ong/funcionarios`.

## Animais internos

Administradores e voluntários de ONGs ativas usam `/api/v1/ong/animais` para cadastrar, listar, consultar e atualizar os animais da própria organização. `idade_aproximada` é armazenada em **meses** (de 0 a 1200). O cadastro define `situacao` como `DISPONIVEL`; `PATCH /api/v1/ong/animais/{animal}/situacao` permite apenas as transições administrativas entre `DISPONIVEL`, `INDISPONIVEL` e `FALECIDO`. Estados de adoção serão tratados no módulo próprio.

## Fotografias e catálogo público

`PATCH /api/v1/ong/animais/{animal}/publicar` e `/despublicar` controlam `publicado` sem mudar a situação. Fotografias são enviadas individualmente para `POST /api/v1/ong/animais/{animal}/fotos` no campo `foto`: JPEG, PNG ou WebP, até 5 MB e oito arquivos por animal. A primeira foto é principal; os endpoints `/fotos`, `/fotos/{foto}/principal` e `/fotos/{foto}` permitem listar, escolher a principal e remover. O disco `public` guarda os arquivos em `animais/{id}`; em uma instalação nova, execute `php artisan storage:link` para servir as URLs retornadas pela API.

`GET /api/v1/public/animais` e `GET /api/v1/public/animais/{animal}` não exigem sessão. O catálogo mostra somente animais publicados, disponíveis e de ONGs ativas. Aceita filtros por `especie`, `sexo`, `porte`, `ongId`, `cidade` e `estado`, com paginação de 15 registros.

## Solicitações de adoção

Um `USUARIO` autenticado cria uma solicitação em `POST /api/v1/adoption-requests`, enviando `animalId` e, opcionalmente, `mensagem`. O animal precisa estar publicado, disponível e vinculado a ONG ativa. A solicitação começa `PENDENTE` e não altera a situação do animal. O usuário lista e cancela suas pendências em `/api/v1/me/adoption-requests`.

Administradores e voluntários de ONG ativa listam, consultam e rejeitam solicitações da própria ONG em `/api/v1/ong/adoption-requests`. A rejeição exige `justificativa` e registra responsável e data. Listagens usam paginação de 15; aprovação, reserva e conclusão pertencem à fase seguinte.
