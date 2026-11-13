# Patas Unidas Web: frontend

Interface em React, TypeScript e Vite, baseada no aplicativo Android. Cadastro e login usam a API Laravel e sessão por cookie HTTP-only; os dados dos animais continuam demonstrativos. Configure `VITE_API_BASE_URL` em `.env` conforme `.env.example`, usando o mesmo hostname do frontend (por exemplo, `127.0.0.1` em ambos). A configuração de CORS e domínios stateful no backend deve incluir a origem e a porta do frontend.

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
npm run build
npm run lint
```

Os dados de animais são locais em `src/features/animals/data.ts`. As fotografias foram substituídas por marcadores provisórios porque o Android referencia um arquivo de créditos ausente; confirme autoria e licença antes de reutilizá-las. A API verifica a sessão e as permissões no servidor.

As imagens pendentes de verificação são `animal_thor.jpg`, `animal_mel.jpg`, `animal_nina.jpg`, `animal_simba.jpg` e `animal_bolinha.jpg`, em `APIsysAnimais/frontend/app/src/main/res/drawable-nodpi/`. Obtenha a origem e a licença ou use fotografias autorizadas correspondentes antes de publicá-las. Os marcadores são intencionais e não geram requisições externas.
