# Patas Unidas Web: frontend

Interface demonstrativa em React, TypeScript e Vite, baseada no aplicativo Android. Não há integração com API, autenticação nem cadastro nesta etapa. Em `/login`, escolha **Explorar demonstração** para navegar pelas telas internas. O acesso é apenas um marcador na sessão do navegador e não fornece segurança ou autenticação.

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
npm run build
npm run lint
```

Os dados de animais são locais em `src/features/animals/data.ts`. As fotografias foram substituídas por marcadores provisórios porque o Android referencia um arquivo de créditos ausente; confirme autoria e licença antes de reutilizá-las. Na futura integração, implemente autenticação, proteção efetiva no servidor, cadastro, CORS e CSRF para Sanctum; nunca confie no modo demonstrativo como controle de acesso.

As imagens pendentes de verificação são `animal_thor.jpg`, `animal_mel.jpg`, `animal_nina.jpg`, `animal_simba.jpg` e `animal_bolinha.jpg`, em `APIsysAnimais/frontend/app/src/main/res/drawable-nodpi/`. Obtenha a origem e a licença ou use fotografias autorizadas correspondentes antes de publicá-las. Os marcadores são intencionais e não geram requisições externas.
