# Inicialização e contingência da demonstração local

Execute os comandos na raiz `/home/flipjacs/IdeaProjects/PatasUnidasWeb`. Este procedimento reutiliza o banco local existente; não recria tabelas, contas ou volumes.

## Pré-requisitos

- Docker com Compose, PHP 8.5 com extensões do Laravel, Composer, Node.js 22 e npm já instalados.
- Dependências previamente instaladas em `backend/vendor` e `frontend/node_modules`.
- Arquivos `.env`, `backend/.env` e `frontend/.env` configurados para o ambiente local. Confira apenas host, portas e nome do banco; não mostre senhas.

## Ordem de inicialização

Terminal 1, na raiz:

```sh
docker compose up -d --wait
docker compose ps
```

Terminal 2:

```sh
cd backend
php artisan migrate:status
php artisan serve --host=127.0.0.1 --port=8001
```

Terminal 3:

```sh
cd frontend
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Abra `http://127.0.0.1:5174`. A API usa `http://127.0.0.1:8001/api/v1` e o Sanctum mantém `/sanctum/csrf-cookie`. Use `127.0.0.1` nos dois serviços, sem misturar com `localhost`.

## Verificação rápida

```sh
docker compose ps
curl -I http://127.0.0.1:8001/up
curl -I http://127.0.0.1:5174/
```

O container MySQL deve estar `healthy`; a porta local esperada é `3309` e o banco é `patas_unidas_web`. A landing deve abrir e o login deve alcançar a API. As migrations já estavam aplicadas em 17/11/2026; não rode migrations destrutivas. Para checar a conexão, use `cd backend && php artisan migrate:status`.

## Contas

As contas de demonstração estão no MySQL local. As credenciais ficam exclusivamente em `/home/flipjacs/.local/share/patas-unidas-demo/`, fora do repositório, com permissão restrita. Consulte `f951-accounts.json`, `f951-creator-password` e `f98-account.json` localmente. Não coloque senhas em slides, comandos, capturas ou documentos versionados.

## Contingência

| Sintoma | Ação local |
| --- | --- |
| MySQL parado | Execute `docker compose up -d --wait` e confira `docker compose ps`; preserve o volume. |
| Backend indisponível | Confira `http://127.0.0.1:8001/up` e reinicie apenas `php artisan serve` no terminal 2. |
| Frontend indisponível | Confira `http://127.0.0.1:5174/` e reinicie apenas `npm run dev` no terminal 3. |
| Porta 8001 ou 5174 ocupada | Use `ss -ltnp` para identificar o processo antes de encerrar qualquer servidor. Mantenha as portas configuradas entre frontend e backend. |
| Sessão expirada | Faça login novamente na interface. |
| CSRF inválido (`419`) | Recarregue a página e refaça login. Confira que frontend e backend usam `127.0.0.1` e que cookies não estão bloqueados. Não desative CSRF. |
| Erro de conexão MySQL | Confirme container `healthy`, porta `3309` e variáveis `DB_CONNECTION`, `DB_HOST`, `DB_PORT` e `DB_DATABASE` em `backend/.env`, sem imprimir credenciais. |

Para encerrar ao final, pare os servidores PHP/Vite com `Ctrl+C`. O MySQL pode permanecer ativo; se for necessário pará-lo, use `docker compose stop`. Não remova volumes.
