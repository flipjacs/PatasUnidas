# F11.5.1 — Integração informacional entre estoque e financeiro

## A. Diagnóstico

Financeiro usa `financial_transactions`, tipos `RECEITA` e `DESPESA`, estados `PENDENTE`, `APROVADA`, `REALIZADA`, `CANCELADA`. Pagamento de despesa é representado por REALIZADA e confirmado_em. Lançamento manual é armazenado com origem_tipo/origem_id nulos; o Resource financeiro o apresenta como MANUAL. Doações e apadrinhamentos geram receitas com origens próprias, nunca despesas de compra.

Estoque já possui InventoryMovementService transacional, bloqueio do produto, lotes, DECIMAL(12,3), histórico imutável e UNIQUE da ONG/chave de operação. Tipos positivos: ENTRADA_COMPRA, ENTRADA_DOACAO, ENTRADA_DEVOLUCAO e AJUSTE_POSITIVO. Os demais tipos são saídas/ajuste negativo.

A consulta financeira existente já permite administrador/voluntário da própria ONG ativa. Relatórios financeiros completos continuam restritos ao administrador. Por isso foi reutilizada a listagem financeira, sem endpoint paralelo nem ampliação de perfil.

## B. Modelagem e constraints

Migration incremental `2026_11_19_225426_link_inventory_entries_to_expenses`, aplicada no MySQL local no batch 18:

- `inventory_movements.despesa_id`: unsigned BIGINT opcional, sem UNIQUE individual.
- Índice composto da movimentação `(ong_id, despesa_id)` para FK e consulta de recebimentos.
- FK composta `(ong_id, despesa_id)` → `financial_transactions(ong_id, id)`, com RESTRICT em exclusão e atualização.
- UNIQUE `(ong_id, id)` na tabela financeira fornece a chave candidata necessária à FK composta, inclusive no MySQL 8.4. Não impõe unicidade da despesa entre diferentes movimentos.

Uma despesa tem várias entradas; cada entrada tem zero ou uma despesa. Relações `InventoryMovement::despesa()` e `FinancialTransaction::entradasEstoque()`. Registros anteriores permanecem com despesa_id null, sem backfill ou inferência por texto.

A FK protege o vínculo institucional movimento/despesa no banco. Produto, lote, autor e ONG continuam validados pelo fluxo de estoque existente. Tipos e estados elegíveis são validados em aplicação sob lock da despesa.

## C–D. Compra e recebimentos parciais

`POST /api/v1/ong/estoque/entradas` recebe o novo campo opcional **despesaId**. Referência não nula só é permitida em `ENTRADA_COMPRA`.

São elegíveis despesas manuais da própria ONG em PENDENTE, APROVADA ou REALIZADA. CANCELADA, receitas e origens automáticas são rejeitadas. Não se exige pagamento prévio nem correspondência entre categoria financeira e categoria do produto.

Uma mesma despesa pode ser enviada em vários comandos, produtos e datas. Cada recebimento físico tem sua própria chave de operação. A API não calcula valor unitário, saldo a receber, percentual da compra ou limite financeiro de quantidades.

Exemplo (IDs obtidos das consultas autorizadas):

```json
{
  "produtoId": 13,
  "tipo": "ENTRADA_COMPRA",
  "quantidade": "20.000",
  "motivo": "Recebimento parcial conferido",
  "despesaId": 33,
  "lote": {"codigo": "LOTE-A", "validade": "2027-01-31"},
  "chaveOperacao": "f1510000-0000-4000-8000-000000000001"
}
```

Compra sem despesaId continua válida. Null equivale à ausência de vínculo. ID não nulo em doação, devolução, saída ou ajuste é rejeitado na validação.

## E. Doação material e privacidade

Não foi criada tabela de doadores, campanha, receita ou relacionamento obrigatório com usuário. Os campos existentes `motivo` e `observacoes` representam a origem operacional; também já participam da idempotência.

```json
{
  "produtoId": 13,
  "tipo": "ENTRADA_DOACAO",
  "quantidade": "2.000",
  "motivo": "Recebimento por doação material",
  "observacoes": "Doação anônima recebida em campanha local, referência interna F151.",
  "chaveOperacao": "f1510000-0000-4000-8000-000000000002"
}
```

Observações são opcionais, até 2000 caracteres. Doação anônima é permitida. Não há campos novos de CPF, telefone, endereço ou data arbitrária do recebimento. Data/hora e responsável são determinados pelo servidor. A origem pode ser descrita de forma curta, sem dados pessoais desnecessários, e permanece no histórico institucional privado. Não há publicação desses dados em transparência ou relatórios públicos.

## F–G. Independência e histórico

Entrada não aprova, paga, cancela ou modifica a despesa. Aprovação/pagamento financeiro não movimentam estoque. Nenhuma entrada cria automaticamente lançamento financeiro. Valor, categoria, datas e responsáveis financeiros não são atualizados pelo Service de estoque.

Movimentação e vínculo confirmado continuam imutáveis. Não há PATCH ou DELETE do vínculo/movimento, nem associação retroativa de históricos antigos. Correção de vínculo histórico exige decisão futura específica, fora desta subfase.

Cancelamento financeiro posterior continua permitido pelas regras anteriores. Ele não remove entradas, lotes ou saldos físicos. O vínculo permanece e mostra o estado financeiro **atual** para perfis autorizados. Novos vínculos com a despesa cancelada são recusados. Retry idêntico de um recebimento já confirmado continua retornando o original, inclusive após cancelamento da despesa.

## H–I. Idempotência e atomicidade

Mantido o mesmo InventoryMovementService. Dentro da transação:

1. Produto próprio é bloqueado.
2. Uma operação anterior com a mesma chave é procurada e seu hash comparado.
3. Para comando novo com vínculo, a Policy financeira é aplicada, a despesa própria é bloqueada e sua elegibilidade revalidada.
4. Lote, saldo, unidade fixada e movimentação com despesa_id são persistidos atomicamente.

O lock da despesa serializa a validação com seu cancelamento/aprovação/pagamento. O cancelamento não foi bloqueado genericamente nem teve regra alterada.

Com vínculo, o ID normalizado da despesa integra o hash. Mesma chave com despesa diferente, ou remoção do vínculo, retorna 409. Repetição idêntica retorna 200, sem nova entrada ou saldo. Sem vínculo, mantém-se exatamente o formato legado do hash; não foi acrescentado null ao fingerprint antigo. Há teste com hash legado persistido e retry de uma movimentação real anterior à migration.

Falha ao persistir o vínculo também reverte lote, produto, histórico e chave. A suíte simula violação da FK composta durante a gravação e confirma rollback e reaproveitamento legítimo da chave após falha.

## J. Resource e erros

O Resource existente ganha somente `despesa`:

```ts
type InventoryExpenseLink = null | {
  id: number;
  descricao?: string;
  status?: 'PENDENTE' | 'APROVADA' | 'REALIZADA' | 'CANCELADA';
};
```

Administrador/voluntário autorizados pela Policy financeira recebem:

```json
{"despesa":{"id":33,"descricao":"Compra de suprimentos","status":"PENDENTE"}}
```

Veterinário autorizado a consultar estoque recebe somente:

```json
{"despesa":{"id":33}}
```

Sem vínculo, `despesa` é null. Nenhum valor, categoria, dado de doador ou detalhe financeiro adicional é incluído no histórico de estoque. Os demais campos do movimento continuam iguais. Relação financeira carregada antecipadamente; resultado da Policy de leitura é reutilizado dentro da requisição para evitar uma consulta de autorização por linha.

Códigos: 201 comando novo; 200 retry idêntico; 400 validação, campo incompatível ou ID malformado; 401 sem sessão/conta ativa; 403 perfil/ONG sem autorização; 404 produto/despesa/movimento externo ou inexistente; 409 despesa própria inelegível ou conflito de idempotência/domínio. Mensagens de recurso externo não revelam valores ou existência de despesas de outra ONG.

## K. Seleção de despesas e consulta inversa

Reutilizada a rota existente, com filtro aditivo:

`GET /api/v1/ong/finance/movimentacoes?vinculavelEstoque=1&page=1`

Administrador e voluntário, pela mesma FinancialTransactionPolicy anterior. O filtro seleciona no banco apenas DESPESA manual, nos três estados elegíveis. Aceita os filtros financeiros existentes, como status, categoriaId, semCategoria, de/ate. Filtros contraditórios produzem resultado vazio. `vinculavelEstoque` aceita somente 1; ausência mantém integralmente o Resource financeiro antigo.

Com o filtro, a resposta é uma projeção reduzida, paginada em 15 registros e ordenada por created_at/ID decrescentes:

```json
{
  "data": [{
    "id": 35,
    "descricao": "Compra de materiais",
    "valor": "8.75",
    "status": "REALIZADA",
    "categoriaDespesa": null,
    "createdAt": "2026-11-19T23:00:00.000000Z"
  }],
  "links": {},
  "meta": {"current_page":1,"last_page":1,"total":1}
}
```

`links`/`meta` completos seguem o paginador Laravel; exemplo abreviado. Categoria estruturada, quando existente: `{id,nome,ativo}`. Não retorna autores, doadores, origem automática ou datas de aprovação/pagamento. O valor é string decimal normalizada. Sem o filtro, o contrato financeiro anterior permanece inalterado.

Para consultar entradas associadas a uma despesa, reutilizado o histórico:

`GET /api/v1/ong/estoque/movimentacoes?despesaId=33&page=1`

Esse filtro adicional exige leitura financeira: administrador/voluntário. Despesa externa/inexistente retorna 404. Funciona também após cancelamento da despesa e pode combinar filtros de estoque existentes. Veterinário continua consultando movimento individual/histórico normal e referência mínima, mas não ganha consulta financeira ou filtro por despesa.

## L. Segurança e desempenho

Mantidos Sanctum, CSRF, conta/ONG ativas, Policies e escopo institucional. ONG, unidade, saldos e funcionário nunca vêm do cliente. `despesa_id` interno não é aceito como alternativa a despesaId. Criador e usuário público permanecem bloqueados.

Nenhum endpoint novo e nenhuma alteração nas Policies foram necessários. A consulta de seleção usa apenas as colunas necessárias, uma relação de categoria e paginação no banco. O histórico carrega despesa antecipadamente; teste compara 1 e 15 movimentos vinculados e confirma quantidade constante de consultas, incluindo a verificação de permissão financeira.

## M. Testes e regressão

Suite completa: **203 testes e 1.708 assertions**, sem falhas. Oito testes específicos de integração cobrem vínculos, múltiplos produtos, recebimentos em datas diferentes, estados elegíveis, cancelamento posterior, tipos/origens inválidos, leitura reduzida por perfil, isolamento, doação sem financeiro, retry legado/novo, FK composta, rollback e ausência de N+1 evidente. A seleção reduzida também é verificada com paginação e contrato financeiro antigo sem filtro.

Pint, sintaxe PHP, rotas, migrations e git diff --check verificados. Testes anteriores de catálogo, lotes, alertas, pagamentos, categorias, análises F11.2, doações financeiras, apadrinhamentos, adoções e prontuários permaneceram aprovados. O frontend não foi alterado nem recebeu funcionalidades F11.5.2.

## N. MySQL real — 19/11/2026

Ambiente local confirmado: MySQL 8.4.13 em Docker saudável, `127.0.0.1:3309/patas_unidas_web`. Antes da migration: 32 lançamentos financeiros e 31 movimentações de estoque. Migration incremental aplicada no batch 18; FK composta confirmada em information_schema com RESTRICT em DELETE/UPDATE.

Cenários executados via HTTP real, Sanctum, cookies e CSRF, marcador `F151-BACKEND`:

- Produtos 13 (ração), 14 (shampoo), 15 (isolamento ONG B).
- Despesa 33, R$ 300,00: três recebimentos de compra, movimentos 32/33/34, incluindo dois produtos e recebimento complementar. Permaneceu PENDENTE durante os recebimentos. Foi cancelada posteriormente por operação financeira explícita; vínculos e estoque preservados.
- Despesa 34, R$ 10,00, ONG B: usada apenas para testar vínculo externo proibido. Rejeição 404, sem movimento parcial.
- Despesa 35, R$ 8,75: aprovação e pagamento executados explicitamente, sem mudar estoque. Recebimentos 36/37 confirmados respectivamente em APROVADA e REALIZADA.
- Doação material, movimento 35: +2 kg, observação anônima, sem vínculo e sem criar receita.
- Retry vinculado retornou 200 com o mesmo movimento; despesa diferente na mesma chave retornou 409.
- Retry do movimento legado 31 retornou 200 sem nova movimentação.
- Voluntário registrou recebimento e consultou seleção reduzida; relatório completo permaneceu 403. Veterinário leu apenas o ID do vínculo, sem escrita/seleção financeira. ONG B recebeu 404 em movimento e filtro de despesa externos.

Saldos finais: produto 13 = 27.000 kg (lote 6 = 25.000, sem lote = 2.000); produto 14 = 7.000 frascos; produto 15 = 0.000. Saldos de todos os produtos foram comparados ao histórico com Decimal, sem float.

Há 35 lançamentos financeiros: os 32 anteriores foram preservados integralmente, e três despesas demonstrativas foram cadastradas explicitamente pela API. As entradas não geraram qualquer lançamento. As análises F11.2 foram comparadas antes/depois de recebimentos/doação e permaneceram idênticas; alterações posteriores vieram das operações financeiras explícitas da demonstração.

Produtos anteriores 1–12, movimentações anteriores, contagens de doações, adoções e prontuários preservados. Os 31 movimentos anteriores continuam sem vínculo financeiro. Evidências locais: `/tmp/f151-before.json`, `/tmp/f151-results.json`, scripts `/tmp/f151-http.py` e `/tmp/f151-legacy.py`. São dados fictícios; não contêm senha, token ou cookie. Arquivos em /tmp podem ser removidos pelo sistema.

Foram registradas 47 operações HTTP nesta validação, além dos logins/CSRF. Não foi executado novo cenário de concorrência entre cancelamento e vínculo nesta subfase; a estratégia de lock foi inspecionada e as transições/retries foram testados. Não se declara cobertura exaustiva de intercalações possíveis.

## O. Arquivos desta implementação

Criados:

- backend/database/migrations/2026_11_19_225426_link_inventory_entries_to_expenses.php
- backend/app/Http/Resources/InventoryExpenseResource.php
- backend/tests/Feature/InventoryFinancialLinkTest.php
- backend/F11_INVENTORY_FINANCE.md

Modificados:

- backend/app/Models/FinancialTransaction.php
- backend/app/Models/InventoryMovement.php
- backend/app/Services/InventoryMovementService.php
- backend/app/Http/Requests/InventoryMovementRequest.php
- backend/app/Http/Requests/InventoryQueryRequest.php
- backend/app/Http/Resources/InventoryMovementResource.php
- backend/app/Http/Controllers/InventoryMovementController.php
- backend/app/Http/Controllers/FinancialController.php

## P–R. Compatibilidade, limites e continuidade

Contratos anteriores preservados. Referência financeira é opcional; movimentações antigas e hashes sem vínculo continuam válidos. Não houve backfill, alteração de valores ou reclassificação. Cancelamento financeiro mantém a regra anterior. Nenhum commit, dependência, frontend, fornecedor, pedido de compra ou nota fiscal foi criado.

Sem bloqueio funcional conhecido. Não há alteração retroativa de vínculos nem registro estruturado de doadores materiais; essas capacidades não pertencem a esta subfase.

Na F11.5.2: consumir a seleção reduzida com paginação, enviar despesaId apenas em compra, incluí-lo na intenção/payload preservado em retries, mostrar estado financeiro atual sem tratá-lo como prova de recebimento e respeitar a referência mínima do veterinário. Doação física utiliza motivo/observacoes e não deve abrir fluxo financeiro nem exigir cadastro de usuário.
