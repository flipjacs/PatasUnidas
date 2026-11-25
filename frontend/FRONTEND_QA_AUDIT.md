# Auditoria funcional e visual do frontend — 21/11/2026

## A. Resumo executivo

Foram abertas **62 combinações de rota e perfil**, correspondentes a **45 caminhos distintos**, pelo Playwright MCP. Houve **49 verificações de rota e viewport** e **39 testes E2E em pytest**. Um defeito visual reproduzível foi encontrado e corrigido: a página `/ong/financeiro` apresentava rolagem horizontal em 320 px. Não foi confirmado defeito P0 ou P1. As verificações de abertura de rota não substituem a execução completa de todos os formulários e transições financeiras.

**Veredito: aprovado para demonstração com ressalva operacional.** Em uma execução de testes com muitos contextos novos, uma carga do Vite ficou temporariamente em branco porque um módulo React pré-compilado falhou na rede; o recarregamento resolveu e não houve reprodução nas 40 cargas frias de investigação. Convém iniciar os serviços e abrir o login antes da apresentação.

## B. Ferramentas utilizadas

- `impeccable`: instruções em `/home/flipjacs/.agents/skills/impeccable/SKILL.md` e material de auditoria e produto; aplicada à inspeção de hierarquia, adaptação móvel, estados e legibilidade. O contexto de produto em `frontend/PRODUCT.md` e os tokens existentes foram preservados.
- **Playwright MCP real**: servidor local `@playwright/mcp`, Playwright `1.66.0-alpha-2026-11-18`, iniciado por stdio e usado para navegar, clicar, selecionar, inspecionar geometria e capturar telas. Os resultados estruturados estão em `artifacts/frontend-qa/mcp-inventory.json` e `responsive-mcp.json`.
- **pytest + Playwright Python**: suíte reproduzível em `tests/e2e/frontend/`, executada separadamente do MCP.
- Vitest, TypeScript, ESLint, build Vite e inspeção das respostas da API Laravel/MySQL. Não foi aberta uma sessão separada do Chrome DevTools; eventos `pageerror`, respostas e requisições foram observados pelo Playwright.

## C. Ambiente

| Item | Verificado |
|---|---|
| Frontend | Vite local em `http://127.0.0.1:5174` |
| Backend | Laravel `13.42.0`, PHP `8.5.12`, em `http://127.0.0.1:8001` |
| Banco | MySQL local `patas_unidas_web`, porta `3309`; contêiner `patas-unidas-web-mysql-1` saudável |
| Navegador | Google Chrome local via Playwright MCP e Playwright Python, modo headless |
| Autenticação | Sessão real de cinco perfis, cookies e API Sanctum; credenciais locais fora do repositório |

As migrations existentes estavam aplicadas. Não foi executado comando destrutivo de banco.

## D. Inventário de telas

Legenda: **MCP** = abertura, heading, `pageerror`, imagens quebradas e overflow; **E2E** = interação/assertion adicional da suíte pytest. Nas 62 aberturas MCP, houve `0` exceções JavaScript, `0` imagens quebradas detectadas e nenhum overflow nas larguras padrão. Uma rota negada exibiu corretamente “Acesso não permitido”. A rede de todas as 62 rotas não foi inspecionada requisição por requisição; respostas de operações críticas foram conferidas nos E2E.

| Rotas | Perfil | Carregamento e interação | Console / rede | Resultado |
|---|---|---|---|---|
| `/`, `/animais`, `/login`, `/cadastro`, `/transparencia` | Público | MCP em cada rota; E2E de headings, filtro de cães, card, ação de apadrinhamento, login inválido e senha curta | Sem `pageerror`; validação de erro visível | Aprovado no escopo testado |
| `/ong`, `/ong/animais`, `/ong/animais/novo`, `/ong/animais/25` | Administrador | MCP; navegação do dashboard, catálogo e detalhe | Sem `pageerror` ou imagem quebrada | Aprovado na abertura |
| `/ong/funcionarios`, `/ong/funcionarios/novo`, `/ong/adocoes` | Administrador | MCP; navegação e formulários renderizados | Sem `pageerror` | Aprovado na abertura |
| `/ong/financeiro`, `/ong/financeiro/novo`, `/ong/financeiro/analise` | Administrador | MCP; filtro de tipo, link de análise, E2E de cadastro, indicador, tabela mensal e validação de período | POST `201`, GET `200`, valor e estado conferidos | Aprovado após correção CSS |
| `/ong/estoque`, `/ong/estoque/novo`, `/ong/estoque/27`, `/ong/estoque/27/editar` | Administrador | MCP; E2E de carregamento, falha de rede simulada e retry | API de produtos voltou após retry | Aprovado no escopo testado |
| `/ong/estoque/27/movimentar/entrada`, `/saida`, `/ajuste` | Administrador | MCP; quantidade zero rejeitada na entrada pelo E2E | Validação visível; nenhuma movimentação enviada no cenário inválido | Aprovado no escopo testado |
| `/ong/estoque/categorias`, `/locais`, `/unidades`, `/movimentacoes`, `/alertas`, `/relatorios` | Administrador | MCP; relatório aberto e período invertido rejeitado pelo E2E | Erro de período exibido | Aprovado no escopo testado |
| `/ong/relatorios`, `/ong/transparencia`, `/ong/transparencia/novo` | Administrador | MCP; headings e navegação | Sem `pageerror` | Aprovado na abertura |
| `/ong/prontuarios`, `/ong/animais/25/prontuarios`, `/ong/doacoes`, `/ong/apadrinhamentos` | Administrador | MCP; headings e navegação | Sem `pageerror` | Aprovado na abertura |
| `/ong`, `/ong/animais`, `/ong/estoque`, `/ong/estoque/movimentacoes`, `/ong/estoque/relatorios`, `/ong/financeiro` | Voluntário | MCP; sessão e restauração E2E | Sem `pageerror` | Aprovado na abertura |
| `/ong/financeiro/analise` | Voluntário | MCP e E2E de bloqueio | Negado como esperado | Aprovado |
| `/ong`, `/ong/animais`, `/ong/prontuarios`, `/ong/animais/25/prontuarios`, `/ong/estoque`, `/ong/estoque/movimentacoes`, `/ong/estoque/relatorios` | Veterinário | MCP; sessão e restauração E2E | API de produtos `200` | Aprovado no escopo testado |
| `/ong/financeiro` | Veterinário | MCP e E2E de bloqueio | API de resumo financeiro `403` | Aprovado |
| `/minha-area`, `/minha-area/solicitacoes`, `/minha-area/doacoes`, `/minha-area/apadrinhamentos`, `/minha-area/adotados` | Usuário | MCP; sessão, restauração e logout E2E | Sem `pageerror` | Aprovado no escopo testado |
| `/animais/25/solicitar`, `/animais/25/doar`, `/animais/25/apadrinhar` | Usuário | MCP; formulários renderizados | Sem `pageerror` | Aprovado na abertura |
| `/ong` | Usuário | MCP e E2E de bloqueio | Negado como esperado | Aprovado |
| `/plataforma`, `/plataforma/ongs/nova` | Criador | MCP; sessão e restauração E2E | Sem `pageerror` | Aprovado na abertura |
| `/ong` | Criador | MCP e E2E de bloqueio | Negado como esperado; API de estoque `403` | Aprovado |

Os caminhos abreviados `/saida`, `/ajuste`, `/locais`, `/unidades`, `/movimentacoes`, `/alertas` e `/relatorios` nas linhas acima usam o mesmo prefixo explícito da primeira rota da linha. Não foram criados recursos para testar envio em todas as telas.

## E. Defeito identificado e corrigido

**QA-UI-01 · P2 · `/ong/financeiro` em 320 × 568.** Ao abrir a página, a largura do documento era **360 px** em uma janela de **320 px**. O link para a análise de despesas herdava `white-space: nowrap` de `.institutional-row-link`, impedindo a quebra dentro do card. A folha de estilo da página de análise é carregada sob demanda e não corrige o link na página financeira principal.

A regra localizada `.finance-analysis-entry .institutional-row-link { white-space: normal; }` foi adicionada a `frontend/src/styles/institutional.css`. Depois, o Playwright MCP mediu `scrollWidth = 320`, `innerWidth = 320` e `white-space: normal`. Capturas: [antes](../artifacts/frontend-qa/finance-320-before.png) e [depois](../artifacts/frontend-qa/finance-320-after.png). Não houve alteração na lógica financeira.

## F. Formulários

- Login inválido: mensagem visível, permaneceu em `/login`. Cinco logins válidos e restauração de sessão foram verificados.
- Cadastro público: senha de sete caracteres rejeitada com indicação do mínimo de oito; cadastro válido não foi repetido para evitar contas de QA desnecessárias.
- Financeiro: administrador registrou despesa manual `12.34` com marcador `QA-FRONTEND-2026`; POST `201`, mensagem de pendência e GET posterior com valor, descrição e status `PENDENTE` conferidos.
- Estoque: entrada com quantidade zero rejeitada na interface; relatório com período invertido exibiu a mensagem específica.
- Outros formulários foram abertos e inspecionados, mas não tiveram todas as combinações de campos e submissões executadas nesta rodada.

## G. Navegação

O MCP abriu rotas públicas, pessoais, institucionais e globais. A suíte E2E verificou filtro do catálogo e navegação ao apadrinhamento, último link da sidebar em `1440 × 600`, filtro financeiro `DESPESA`, passagem à análise, menu móvel, fechamento por `Escape`, retorno do foco ao acionador e logout. Links e ações de negócio não usados nesses cenários receberam apenas verificação de carregamento; não há alegação de teste individual de todos os botões.

## H. API e rede

- Sem erro JavaScript não tratado nas 62 aberturas MCP. Respostas intencionalmente negadas `403`/`404` e validações não foram classificadas como defeitos.
- Falha de rede **simulada** no GET de produtos: a interface mostrou “Tentar novamente” e recuperou a tabela depois de remover a interceptação. Isso não é prova de indisponibilidade real da API.
- Uma abertura de `/login` ficou vazia durante a carga rápida de múltiplos contextos; o diagnóstico registrou falha de requisição ao módulo Vite `/node_modules/.vite/deps/react-PYT6vkka.js`. Um reload recuperou a tela. A requisição posterior respondeu `200`, e 40 novas aberturas frias não reproduziram. Não foi alterado código de autenticação sem causa persistente comprovada.
- Não foi observado timeout persistente nem duplicação de operação nos fluxos executados. Não foi feita captura exaustiva de todas as requisições de todas as telas.

## I. Permissões e isolamento

Administrador A abriu financeiro, análise e estoque. Voluntário abriu o financeiro operacional e recebeu bloqueio na análise. Veterinário abriu estoque em leitura (`200`) e teve financeiro negado (`403`). Usuário público e criador tiveram API de estoque negada (`403`). O produto visível para o administrador da ONG A retornou `404` na sessão independente do administrador da ONG B. As sessões e a navegação por perfil foram exercitadas no navegador; esse conjunto é representativo, sem substituir toda a matriz de políticas do backend.

## J. Responsividade

MCP: **49 verificações** em landing, catálogo, dashboard, financeiro, análise, estoque e relatórios de estoque, nas larguras **320, 375, 430, 768, 1024, 1366 e 1440 px**. Foram usadas as alturas solicitadas `568`, `667`, `932`, `800`, `600`, `768` e `900 px`. O E2E acrescentou `900 × 700` perto do breakpoint. O overflow financeiro a 320 px foi corrigido; não restou overflow nos cenários medidos. Capturas adicionais: [drawer 375](../artifacts/frontend-qa/drawer-375.png), [financeiro 1366](../artifacts/frontend-qa/finance-1366.png), [relatório de estoque 375](../artifacts/frontend-qa/inventory-reports-375.png) e [relatório 1366](../artifacts/frontend-qa/inventory-reports-1366-loaded.png). Não foi executada inspeção sistemática em zoom de 200%.

## K. Acessibilidade

Foram exercitados nomes acessíveis de headings, campos e botões, `Escape` e retorno de foco do drawer, links navegáveis por teclado e sidebar rolável. A tabela alternativa do gráfico de despesas foi aberta e identificada por nome acessível. As telas de relatório de estoque foram visualizadas em desktop e mobile. Não foi executada auditoria WCAG completa, medição sistemática de contraste ou teste com leitor de tela. Tooltips dos gráficos não receberam verificação exaustiva por teclado nesta rodada.

## L. pytest

Arquivos: `tests/e2e/frontend/conftest.py`, `test_browser_flows.py` e `README.md`. O ambiente virtual de QA fica em `/tmp/patas-frontend-qa-venv`, sem alterar dependências de produção. Com serviços locais ativos:

```bash
/tmp/patas-frontend-qa-venv/bin/pytest -q tests/e2e/frontend
```

**Resultado: 39 passaram, 0 falharam, 0 ignorados, em 107,60 s.** Incluem rotas públicas, filtro do catálogo e link ao apadrinhamento, cinco perfis, autorização visual e API, duas ONGs, sessão, formulário persistente, validações, falha de rede simulada, tabela mensal de despesas, indicador financeiro comparado ao agregado da API e responsividade. Evidências de falha, quando existirem, são mantidas em `artifacts/frontend-qa/failures/`, ignoradas pelo Git.

## M. Vitest e verificações de código

**Vitest: 18 arquivos, 125 testes aprovados, 0 falhas.** `npm run lint`, `npm run build` e o TypeScript executado pelo build (`tsc -b`) passaram. `git diff --check` passou. O build Vite 8.3.7 gerou arquivo principal de **325,15 kB** (gzip **97,64 kB**). Não foram adicionadas dependências do frontend. Os testes existentes incluem avisos de rota ausente em um cenário de teste de adoção, sem falha.

## N. Integridade e dados

O cenário persistente criou somente despesas pendentes marcadas `QA-FRONTEND-2026`; após a regressão final, **sete registros** desse marcador estavam no MySQL, todos `PENDENTE`, com soma decimal `86.38`. O teste da operação mais recente conferiu o registro individual pela API após o POST. Nenhuma despesa foi aprovada ou paga nesta auditoria. Os agregados mostrados na tela financeira foram comparados aos campos da API com `Decimal`, sem reconstruir totais de páginas. Os registros de demonstração anteriores permaneceram preservados. Nenhuma migração destrutiva, exclusão geral ou alteração de saldo foi executada.

## O. Arquivos alterados nesta auditoria

| Arquivo | Motivo |
|---|---|
| `frontend/src/styles/institutional.css` | Quebra de linha localizada no link da análise financeira em viewport estreita. |
| `.gitignore` | Ignorar capturas/diagnósticos de QA, dados do Playwright MCP e caches Python. |
| `tests/e2e/frontend/conftest.py` | Fixtures de navegador, sessão local e credenciais com representação ocultada. |
| `tests/e2e/frontend/test_browser_flows.py` | 37 cenários parametrizados de navegador, API e responsividade. |
| `tests/e2e/frontend/README.md` | Execução local reproduzível. |
| `frontend/FRONTEND_QA_AUDIT.md` | Este relatório. |

O repositório já continha muitas alterações locais das fases F11 antes desta auditoria. Elas foram preservadas; nenhum commit foi criado.

## P. Pendências concretas

| Severidade | Pendência | Impacto |
|---|---|---|
| P2 operacional | Uma falha intermitente de carga do módulo pré-compilado do Vite apareceu sob criação rápida de contextos; não reproduzida em 40 cargas frias. | Pode exigir recarregar o login durante desenvolvimento. Revalidar se ocorrer em uso normal ou no build de apresentação. |
| Lacuna de cobertura | Não foram executadas todas as mutações de adoções, doações, apadrinhamentos, prontuários, estoque e transparência; também não houve zoom 200% ou leitor de tela. | A aprovação desta auditoria vale para os cenários enumerados e para a regressão existente, sem alegar cobertura universal. |

## Q. Conclusão

**Aprovado para demonstração com ressalva operacional.** O defeito responsivo confirmado foi corrigido e revalidado no navegador; os 39 E2E, 125 testes Vitest, build, lint e TypeScript passaram. A falha transitória do servidor Vite deve ser observada na inicialização da demonstração. Não há P0/P1 confirmado em aberto nos fluxos cobertos. A aplicação continua usando o Laravel e o MySQL reais, sem mocks para as operações persistentes validadas.
