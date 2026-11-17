# Patas Unidas Web: frontend

Interface em React, TypeScript e Vite. Cadastro e login usam a API Laravel com sessão por cookie HTTP-only. O catálogo e os detalhes consultam os animais publicados na API pública em `/api/v1/public/animais`; suas fotografias usam exclusivamente as URLs controladas retornadas pela API. Configure `VITE_API_BASE_URL` em `.env` conforme `.env.example`, usando o mesmo hostname no frontend e backend (por exemplo, `127.0.0.1` em ambos). A configuração de CORS e dos domínios stateful no Laravel deve incluir a origem e a porta do frontend.

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
npm run build
npm run lint
```

A landing em `/`, o catálogo e os detalhes dos animais são públicos. O login direciona `USUARIO` para `/minha-area`, funcionários de ONG para `/ong` e `CRIADOR_PLATAFORMA` para `/plataforma`. As três rotas privadas verificam a sessão em `/api/v1/auth/me` e restringem o acesso por perfil. O primeiro acesso do administrador convidado está em `/primeiro-acesso` e utiliza `/api/v1/auth/primeiro-acesso`. O shell interno fica em `src/features/workspace/` e mostra somente destinos implementados. A API de autenticação fornece o nome e o estado da ONG no contexto institucional; as operações continuam sujeitas à autorização do backend.

A landing mostra até três animais consultados em `/api/v1/public/animais` e não apresenta métricas de impacto sem uma fonte pública confiável. O hero usa uma ilustração gerada digitalmente, identificada na própria página; ela não representa um animal cadastrado. Os estilos e tokens da identidade amazônica estão em `src/styles/index.css`, com estilos específicos da landing em `src/styles/landing.css`, do espaço interno em `src/styles/workspace.css` e convenções resumidas em `DESIGN_SYSTEM.md`.

Os nomes de arquivo do Android `animal_thor.jpg`, `animal_mel.jpg`, `animal_nina.jpg`, `animal_simba.jpg` e `animal_bolinha.jpg`, em `APIsysAnimais/frontend/app/src/main/res/drawable-nodpi/`, ainda não têm procedência e licença confirmadas. Por isso, não foram publicados no frontend. Quando a API não informa fotografia, a interface apresenta um marcador identificado como indisponível.
