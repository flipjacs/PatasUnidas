# F11.7.1 — Validação integrada do backend

Data local: 21/11/2026. Escopo: F11.1–F11.6, somente validação e correção de defeitos comprovados.

## A. Resumo executivo

**Aprovado nos cenários executados.** PHPUnit: **208 testes, 1.794 assertions, 0 falhas**. MySQL 8.4.13 local (`patas_unidas_web`, Docker saudável), PHP/Laravel 13.42, sessões Sanctum e CSRF reais. Nenhum defeito P0/P1 reproduzido; nenhuma correção de código necessária. O frontend permaneceu inalterado nesta subfase. Os dados anteriores foram preservados.

## B. Matriz crítica

| Módulo/cenário | Risco | Esperado | Observado e evidência | Situação |
|---|---|---|---|---|
| Saídas simultâneas | P0, saldo negativo | Uma de duas saídas de 8 sobre saldo 10 | Duas sessões e workers PHP independentes, disparo sincronizado; HTTP `201`/`409`; saldo posterior 2.000, uma saída | Aprovado |
| Retry idêntico e payload alterado | P0, duplicação | `200` sem novo saldo; `409` para alteração | Entrada 1.000: `201`, repetição `200`, alteração `409`; saldo 3.000; nenhuma chave duplicada no MySQL | Aprovado |
| Saldos e lotes F171 | P0, inconsistência | Soma algébrica igual ao saldo | Produtos 23/24/25: 3.000/6.000/2.000; 3/3/2 movimentos; dois lotes coerentes | Aprovado |
| Vínculo estoque–despesa | P0, fuga entre ONGs | FK composta e mesmo ONG | Oito movimentos vinculados; zero pares ONG divergentes; FK `RESTRICT`/`RESTRICT` no MySQL | Aprovado |
| Histórico e precisão | P1, perda de rastreabilidade | Responsável, hora, antes/depois, DECIMAL | Todos os novos movimentos possuem dados obrigatórios; 2.125 kg − 0.125 kg = 2.000 kg | Aprovado |
| Lote vencido | P1, consumo indevido | Consumo negado; descarte permitido | Consumo `409`; descarte `201`; lote vencido remanescente 1.000 dose e alertado | Aprovado |
| Permissões e isolamento | P1, acesso indevido | Perfil/ONG próprios | Voluntário ajustar `403`; veterinário escrever `403`, relatório operacional `200`; usuário relatório `403`; ONG B produto/filtro de A `404` | Aprovado |
| Análise financeira | P1, total incorreto | Data efetiva e estado | API = SQL DECIMAL: pago 91.48, pendente 326.64, aprovado 7.07 | Aprovado |
| Relatório de estoque | P1, agregação errada | Tipos e lotes separados | Produto 23: uma saída consumo; produto 24: um descarte, um lote vencido com 1.000 dose; agregado e MySQL conferidos | Aprovado |
| API anterior | P2, regressão | Rotas e testes preservados | 23 rotas de estoque registradas; 208 testes aprovados | Aprovado |

A matriz resume cenários executados nesta etapa. Outras combinações de categorias, filtros, inatividade, rollback e autorização são cobertas pelos testes Feature existentes, especialmente `ExpenseCategoryApiTest`, `ExpenseAnalysisTest`, `InventoryApiTest`, `InventoryMovementApiTest`, `InventoryFinancialLinkTest` e `InventoryReportTest`. Não foram repetidas manualmente todas as combinações.

## C–D. Categorias e análise financeira

O campo legado `categoria` permanece; 13 despesas antigas seguem sem `categoria_id` estruturado, sem reclassificação automática. Testes Feature cobrem categoria global/customizada, inativação histórica, filtro e isolamento. A consulta financeira foi comparada em três estados com SQL MySQL filtrando pelo campo correto: `confirmado_em` para REALIZADA, `created_at` para PENDENTE e `aprovado_em` para APROVADA. Comparação em `Decimal`, sem ponto flutuante.

## E–F. Catálogo, movimentos e reconciliação

Os dados F171 foram criados pelos endpoints legítimos. Produto 23 (unidade): entrada 10, uma saída concorrente 8, retry de entrada 1, saldo 3. Produto 24 (dose): entradas 5 e 2 em lotes, descarte 1 do vencido, saldo 6. Produto 25 (kg): entrada 2.125, consumo 0.125, saldo 2.000. A soma de cada histórico confere com o saldo materializado. MySQL retornou zero produtos e lotes com saldo negativo. PATCH arbitrário de `quantidadeDisponivel` recebeu `400`; saída acima do saldo `409`; zero e fração de unidade indivisível `400`.

## G–H. Concorrência e idempotência

Laravel foi servido localmente na porta 8002 com `PHP_CLI_SERVER_WORKERS=4` e `--no-reload`; `ps` confirmou processos PHP distintos. Duas sessões HTTP autenticadas e com cookies/CSRF próprios foram liberadas por barreira de threads para enviar simultaneamente saídas de 8 sobre 10. Resultados `201`/`409`; MySQL confirmou saldo 2.000 e apenas uma saída. Não foi realizado benchmark nem prova formal de interleaving interno ao lock, mas as requisições foram disparadas sobrepostas de conexões independentes. Retry idêntico da entrada resultou em `200` e payload diferente com mesma chave em `409`. A consulta MySQL encontrou zero chaves duplicadas por ONG.

## I. Lotes e validade

Lote válido foi recebido com 5 doses; lote vencido com 2. Consumo do vencido retornou `409`; descarte justificado de 1 retornou `201`; o lote manteve 1 dose e apareceu em alerta. Os saldos dos dois lotes não excedem o saldo do produto. Casos de controle obrigatório, validade civil, lote externo/vazio são cobertos pela suíte Feature existente.

## J. Integração física–financeira

Há oito entradas vinculadas e nenhum vínculo cruzado entre ONGs. A FK composta `(ong_id, despesa_id)` segue com RESTRICT. O teste de doação física não criou novo lançamento financeiro nesta rodada; a independência é coberta pelo cenário HTTP F11.5 anterior e pela suíte. O número de transações financeiras permaneceu 39 durante a rodada F171. Despesas canceladas, origens automáticas, recebimentos parciais, rollback de FK, elegibilidade e permissões de seleção são cobertos por `InventoryFinancialLinkTest` e pelos testes HTTP prévios documentados em `F11_INVENTORY_FINANCE.md`.

## K. Relatórios de estoque

A API preservou separação por unidade, operação e lote: consumo, descarte e validade não foram confundidos. O relatório filtrado do produto 23 mostrou uma saída por consumo e 8.000 unidades consumidas; produto 24 mostrou um descarte e 1.000 dose vencida. O histórico e os indicadores usam as agregações SQL documentadas em `F11_INVENTORY_REPORTS.md`, sem nova consulta por produto/categoria. A fila de críticos e filtros retornaram os códigos esperados.

## L. Segurança

Contas e ONGs derivadas da sessão; usuário comum e criador não recebem contexto institucional. Autorizações diretas verificadas por HTTP para administrador, voluntário, veterinário, usuário e outra ONG. A suíte cobre criador, conta inativa, ONG suspensa, campos protegidos e IDs externos. Nenhuma senha, cookie ou token foi registrado neste documento. Os scripts transitórios de teste ficaram em `/tmp`, fora do repositório.

## M. Regressão e ambiente

- PHPUnit completo: **208/208 testes, 1.794 assertions**.
- Pint `--dirty --format agent`: passou.
- Sintaxe `php -l` em `app`, `routes` e `tests`: sem erros.
- Rotas: 23 rotas de estoque registradas, incluindo os dois relatórios F11.6.
- Migrations: lotes 1–18 aplicados, nenhuma migration pendente ou destrutiva executada.
- `git diff --check`: passou.
- Banco local confirmado antes de escrever: MySQL 8.4.13, `127.0.0.1:3309`, `patas_unidas_web`, Docker saudável.

## N. Arquivos alterados

Somente este documento foi criado nesta subfase. Não houve modificação de código, testes existentes, frontend ou banco estrutural. Foram criados três produtos F171 e oito movimentações de teste; registros anteriores preservados.

## O. Pendências

Nenhum defeito P0/P1 confirmado. Não foi executada nesta rodada a combinação simultânea de **mesma chave** em duas requisições, nem uma corrida de duas entradas distintas; já existe cobertura de idempotência sequencial e testes anteriores de concorrência. Esses cenários não bloqueiam a F11.7.2, mas são limites desta evidência específica. Não foi refeito um teste manual de todas as permissões e filtros da matriz; a suíte Feature cobre os caminhos não repetidos.

## P. Continuidade F11.7.2

Backend apto para validar no navegador os fluxos React de categorias, análises, catálogo, movimentações, vínculos e relatórios. Reutilizar os produtos F171 IDs 23–25 para consultas; evitar novas saídas nesses produtos, porque representam estados controlados desta evidência. Usar conta demonstrativa local por perfil, sem publicar credenciais. Distinguir no UI situação atual do estoque de movimentações do período e valores financeiros de quantidades físicas. Frontend F11.7.2 não foi iniciado.
