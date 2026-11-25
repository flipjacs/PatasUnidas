# F11.7.2 — Validação integrada do frontend

Data: 21/11/2026. Ambiente exclusivamente local, com dados fictícios marcados `F172-FRONTEND`.

## A. Resumo executivo

**F11.7.2 concluída. Expansão F11 encerrada.** Os fluxos críticos executados no Chrome, com Laravel e MySQL reais, passaram. Não foi reproduzido defeito P0/P1. Nenhum arquivo de implementação ou do backend foi modificado nesta subfase. Uma limitação visual P2 está descrita em **S**.

## B. Ambiente e método

- Vite `http://127.0.0.1:5174`, Laravel `http://127.0.0.1:8001`, MySQL Docker local saudável em `127.0.0.1:3309`, banco `patas_unidas_web` confirmado pelo Laravel como `mysql`.
- Navegador **Google Chrome via CDP**, sessão Sanctum real com cookie e CSRF; não foi utilizado Playwright. Credenciais locais restritas foram lidas sem imprimir senhas, cookies ou tokens.
- Orientações da skill `impeccable` e do registro `reference/product.md` usadas para inspecionar legibilidade, hierarquia, formulários, tabelas e mobile. `PRODUCT.md` ausente conforme a inicialização anterior da skill; não foi criado documento estratégico fora do escopo.
- A documentação F11 do backend, `F11_INVENTORY_OPERATIONS.md`, `F11_INVENTORY_FINANCE_UI.md`, `DEMO.md` e `RUNBOOK.md` foi consultada. Os contratos da API foram comparados com as respostas reais.

## C. Matriz de validação

| Funcionalidade | Perfil e cenário | Esperado | Observado e evidência | Estado |
|---|---|---|---|---|
| Login e rotas | Admin A, voluntário, veterinário, admin B, usuário | Redirecionamento por perfil e sessão persistente | Logins reais foram a `/ong` ou `/minha-area`; recarga de rotas internas retornou conteúdo autorizado | Aprovado |
| Perfil restrito | Voluntário em `/ong/financeiro/analise` e ajuste; veterinário em entrada/análise; usuário em `/ong/estoque` | Acesso negado | Telas exibiram `Acesso não permitido` ou bloqueio de escrita; veterinário viu produto e relatório em leitura | Aprovado |
| Isolamento | Admin B consulta produto 27, catálogo, categorias e relatório | Nenhum dado da ONG A | Produto 27 retornou 404; busca F172 retornou zero produtos/categorias; relatório da ONG B: 3 produtos e 1 operação | Aprovado |
| Categorias financeiras | Admin cria, renomeia, usa e desativa categoria 15 | Histórico preservado | Categoria 15 ficou inativa; despesa 40 permaneceu associada e pendente; filtro por ID e filtro `semCategoria` consultados | Aprovado |
| Análise financeira | Admin abre página e compara agregados | Pagos separados de pendentes e aprovados | UI/API: R$ 91,48 pagos; R$ 338,98 pendentes; R$ 7,07 aprovados; tabela alternativa presente | Aprovado |
| Produto | Admin cria e edita produto 27 | Saldo não editável pelo cadastro | Produto criado com zero, editado com local 3 e descrição; saldo alterado apenas por movimentos | Aprovado |
| Referências | Admin cria e desativa local 3 | Vínculo histórico preservado | Local inativo ainda aparece no produto 27 | Aprovado |
| Movimentações | Admin registra entrada, saída e ajuste; voluntário registra entrada | Uma linha por operação e saldo correto | Movimentos 64–72, produto 27 com saldo final `14.000`; sequência e responsáveis conferidos no MySQL | Aprovado |
| Lotes e alertas | Admin cria lotes 11 e 12, descarta vencido | Consumo vencido bloqueado; descarte permitido | Opção vencida desabilitada para consumo; descarte 70 persistiu; alertas `VENCIDO`, `PROXIMO_VENCIMENTO` e `ESGOTADO` carregaram | Aprovado |
| Compra vinculada | Admin vincula duas entradas à despesa 40 | Duas entradas, uma despesa pendente | Movimentos 67 e 68 mostram `despesa_id=40`; detalhe financeiro lista ambos; valor `12.34` e estado `PENDENTE` preservados | Aprovado |
| Doação material | Admin e voluntário registram entradas físicas | Sem receita automática | Movimentos 64, 69, 71 e 72 sem vínculo financeiro; único lançamento F172 foi a despesa manual 40 | Aprovado |
| Relatórios | Admin filtra produto 27 e período 21/11/2026 | API e UI iguais | 1 produto, 8 operações, 5 entradas, 2 saídas, 1 ajuste; API confirmou; filtro invertido exibiu erro e não mudou URL | Aprovado |
| Idempotência | Duplo clique e resposta perdida após POST | Uma intenção, uma movimentação | Cliques duplos resultaram em 67 e 68, um por intenção. CDP descartou resposta 201 do movimento 71; retry recebeu 200, 1 registro e saldo +1 | Aprovado |
| Conflito | Saída de 100 sem saldo | Erro sem mutação | HTTP 409; mensagem de saldo insuficiente, quantidade preenchida e saldo atual preservados | Aprovado |
| Catálogo: busca, paginação e filtros | Cobertura automatizada existente; navegação real da lista | Filtragem no servidor | Listas e paginação carregaram; todas as combinações não foram repetidas manualmente | Aprovado por testes existentes; amostra real |
| Desativação de produto, categoria de estoque e locais adicionais | Casos automatizados da F11.3 | Sem perda de histórico | Desativação de local foi executada nesta subfase; as demais não foram repetidas em registros reais | Não executado manualmente |

## D–G. Navegação, financeiro e catálogo

O login da interface usou `/sanctum/csrf-cookie` e `/api/v1/auth/login`; o perfil veio de `/auth/me`. Os links institucionais e a recarga de rotas internas funcionaram. O administrador vê o gerenciamento financeiro; o voluntário vê categorias sem controles administrativos; o veterinário não recebe operações financeiras. Categorias globais coexistem com a categoria institucional 15. O filtro `categoriaId=15` manteve a despesa 40, enquanto `semCategoria=1` não a retornou. A análise usa os agregados da API, não soma linhas paginadas. A interface distinguiu `PENDENTE`, `APROVADA` e `REALIZADA`.

O catálogo de estoque apresentou busca, filtros de categoria, unidade, local e atividade, página de detalhes, cadastro e edição. A quantidade disponível é somente leitura no formulário. Unidades padronizadas e categorias/locais institucionais carregaram. O local 3 foi criado e desativado por fluxo real, preservando seu vínculo com o produto.

## H–J. Movimentos, lotes e integração financeira

No produto 27: entrada de 10, saída de 3, ajuste +1, compras vinculadas de 2 e 1, doação de 2, descarte de 1, retry de entrada +1 e entrada do voluntário +1. Saldos registrados: `0→10→7→8→10→11→13→12→13→14`. As nove linhas 64–72 existem no MySQL; a quantidade materializada é `14.000`. O histórico mostrou tipo, responsável, motivo, quantidade, saldo anterior/posterior e lote, sem controles de edição.

Lote 11 `F172-LOT-VALIDO`, validade civil 01/12/2026, saldo `3.000`; lote 12 `F172-LOT-VENCIDO`, validade 01/11/2026, saldo `1.000` após descarte. A listagem diferencia vencido e próximo do vencimento. A compra vinculou duas entradas à despesa 40 e o detalhe financeiro apresentou ambos os recebimentos; o vínculo não pagou a despesa. O formulário de doação física informou que não cria receita monetária, e o MySQL não recebeu receita por essas entradas.

## K. Relatórios de estoque

As sete seções foram observadas: disponibilidade atual, críticos, consumo por categoria e unidade, evolução mensal, ranking por frequência, validade e contagens de movimentos. O filtro de produto/período produziu os mesmos números na UI e na API. As séries mensais incluem meses sem movimento; as quantidades de unidades diferentes são apresentadas separadamente. O gráfico tem tabela alternativa com `<table>`, `<caption>` e cabeçalhos.

## L–M. Idempotência e segurança

O clique duplo no botão de compra foi submetido como uma única intenção por formulário. No cenário de resultado desconhecido, o Chrome CDP interrompeu **a resposta** de um POST 201 já processado; a interface manteve o comando e ofereceu retry seguro. O retry retornou 200 para o mesmo movimento 71; uma única linha com o motivo F172 de retry foi encontrada no MySQL. O produto não teve incremento duplicado.

Voluntário registrou movimento 72, mas o ajuste e a análise financeira ficaram bloqueados. Veterinário consultou produto/relatório sem botões de escrita; rota de entrada e análise financeira foram negadas. Administrador B não acessou produto 27 e não recebeu produtos/categorias F172 nas consultas. Usuário público não entrou na área institucional. A autorização efetiva foi conferida nas respostas da API, não apenas pelos botões ocultos. Controles de conta/ONG inativa e outras combinações permanecem cobertos pela suíte backend da F11.7.1; não foram repetidos manualmente aqui.

## N–O. Responsividade e acessibilidade

No Chrome foram renderizadas 9 páginas prioritárias em **320×568, 375×667, 430×932, 768×800, 1024×600, 1366×768 e 1440×900**: 63 combinações, sem overflow horizontal do documento após carregar o título. Tabelas mantêm contêiner rolável. No drawer de 320×568, a navegação mediu `scrollHeight=1138` e `clientHeight=568`; foi rolada até o fim. Escape fechou o drawer, restaurou o foco ao botão acionador e liberou a rolagem do corpo. Formulários usam labels e associam erros de campo via `aria-invalid`/`aria-describedby`; o erro de saldo permaneceu legível. Gráficos de relatório/financeiro oferecem leitura textual ou tabular. Isto é uma verificação prática, **não** uma certificação WCAG completa; contraste numérico e leitor de tela não foram medidos.

Capturas locais: `/tmp/f172-stock-report-full.png`, `/tmp/f172-report-mobile.png`, `/tmp/f172-drawer-open.png`, `/tmp/f172-drawer-bottom.png`, `/tmp/f172-entry-form.png`, `/tmp/f172-exit-form.png`, `/tmp/f172-adjust-form.png`, `/tmp/f172-receipts.png`, `/tmp/f172-vet-readonly.png`, `/tmp/f172-insufficient.png`. São evidências temporárias locais, sem credenciais.

## P–R. Regressão, MySQL e arquivos

- `npm test -- --run`: **125 testes, 18 arquivos, 0 falhas**.
- `npm run build`: passou; inclui `tsc -b`, 153 módulos transformados.
- `npm run lint`: passou.
- `git diff --check`: passou.
- Backend F11.7.1: 208 testes / 1.794 assertions, conforme validação imediatamente anterior. A suíte backend não foi repetida nesta subfase, pois nenhum código Laravel foi alterado.
- MySQL: banco `patas_unidas_web` confirmado; ONG A (ID 3) ficou com 23 produtos e 71 movimentos; ONG B (ID 4), 3 produtos e 1 movimento. Produto 27, despesa 40, categoria financeira 15 e local 3 são registros de teste F172. Dados anteriores foram preservados. Nenhuma migration ou seeder foi executada.
- **Arquivo criado:** `frontend/F11_FRONTEND_VALIDATION.md`. Nenhum arquivo de implementação foi alterado.

## S. Pendência concreta

**P2, não bloqueante:** o alerta de lotes exibe a quantidade sem a sigla da unidade. O contrato atual de `InventoryLotResource` devolve o produto com ID e nome, mas não sua unidade; a tela fornece link para o detalhe do produto, onde a unidade está explícita. Não foi criado carregamento por lote nem alterado o backend nesta subfase. Uma alteração aditiva no Resource e na tipagem frontend resolveria o ponto em trabalho futuro, se priorizado.

Também não foi executado leitor de tela nem teste manual de todas as combinações de filtros ou de desativação de produto. Esses casos não impediram os fluxos críticos e têm cobertura automatizada existente, mas não são apresentados aqui como validações manuais.

## T. Encerramento

Os critérios críticos de autenticação, autorização, isolamento, saldo, lote, vínculo financeiro, retry, relatórios e uso em mobile foram confirmados. Não há defeito P0/P1 reproduzido nem mudança funcional pendente nesta fase. **F11.7.2 concluída. Expansão F11 encerrada.**
