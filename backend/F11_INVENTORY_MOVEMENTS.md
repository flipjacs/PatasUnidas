# F11.4.1 — Movimentações e alertas de estoque

## Acesso e compatibilidade

Base `/api/v1/ong/estoque`, autenticação Sanctum por sessão e CSRF existentes. Conta e ONG precisam estar ativas. A ONG e o responsável vêm da sessão. Não enviar ONG, funcionário, unidade ou saldos no corpo.

Administrador e voluntário registram entradas e saídas. Apenas administrador registra ajustes. Administrador, voluntário e veterinário consultam histórico, lotes e alertas. Usuário público e criador não acessam o estoque institucional. As decisões são aplicadas por `InventoryProductPolicy`, além do escopo das consultas.

O catálogo F11.3 mantém rotas, campos e paginação. Não há integração financeira. Nenhuma movimentação cria receita, despesa ou doação pública.

## Persistência e invariantes

Migrations incrementais:

- `2026_11_19_215821_create_inventory_movements_and_lots`: tabelas `inventory_lots` e `inventory_movements`.
- `2026_11_19_220517_add_expiry_control_to_inventory_products`: boolean `controla_validade`, default false para preservar produtos existentes.

Lote: ONG, produto, código normalizado em maiúsculas, validade civil opcional, quantidade DECIMAL(12,3) e timestamps. UNIQUE produto/código, índice ONG/validade. Código e validade são imutáveis pelo contrato: não há PATCH de lote. Receber novamente o mesmo código exige a mesma validade ou o uso de `loteId`.

Movimentação: ONG, produto, unidade original, lote opcional, responsável, tipo, quantidade positiva, saldo anterior/posterior, motivo, observações, UUID de operação, hash do comando e created_at. UNIQUE ONG/chave de operação, índices ONG/data e produto/ID. Todas as FKs restringem exclusão. Não há endpoints de edição/exclusão de movimentos ou substituição direta do saldo.

O saldo físico total permanece em `inventory_products.quantidade_disponivel`. Os lotes representam parcelas desse saldo. A quantidade sem lote é calculada como total menos SUM dos lotes; não possui um segundo contador independente. Todas as escritas bloqueiam o produto primeiro e atualizam lote, produto e movimento na mesma transação. Falha em qualquer gravação reverte todas. A unidade fica fixada na primeira movimentação, mesmo após zerar o saldo.

Quantidades são strings decimais, máximo `999999999.999`, até três casas, maiores que zero. O cálculo usa inteiros de milésimos em PHP de 64 bits e DECIMAL no MySQL, sem conversão para float. Unidades indivisíveis exigem fração matematicamente zero. Não há conversões de unidades.

## Rotas

| Método | Caminho após a base | Acesso | Resposta |
|---|---|---|---|
| POST | `/entradas` | Administrador, voluntário | Movimento, 201; retry idêntico 200 |
| POST | `/saidas` | Administrador, voluntário | Movimento, 201; retry idêntico 200 |
| POST | `/ajustes` | Administrador | Movimento, 201; retry idêntico 200 |
| GET | `/movimentacoes` | Três perfis internos | Página de 15 |
| GET | `/movimentacoes/{movimentacao}` | Três perfis internos | Movimento |
| GET | `/produtos/{produto}/lotes` | Três perfis internos | Página de 15 lotes, incluindo vazios para histórico |
| GET | `/alertas` | Três perfis internos | Página de 15 produtos ou lotes conforme tipo |

Validação retorna **400**, conforme o handler existente; 401 sem sessão/conta ativa, 403 operação ou ONG proibida, 404 recurso externo/inexistente, 409 conflito de domínio. Campos desconhecidos são rejeitados.

## Comandos

Entrada sem lote:

```json
{
  "produtoId": 5,
  "tipo": "ENTRADA_COMPRA",
  "quantidade": "25.000",
  "motivo": "Recebimento físico conferido",
  "observacoes": null,
  "chaveOperacao": "f1410000-0000-4000-8000-000000000001"
}
```

Tipos de `/entradas`: `ENTRADA_COMPRA`, `ENTRADA_DOACAO`, `ENTRADA_DEVOLUCAO`.
Tipos de `/saidas`: `SAIDA_CONSUMO`, `SAIDA_PERDA`, `SAIDA_DESCARTE`.
Tipos de `/ajustes`: `AJUSTE_POSITIVO`, `AJUSTE_NEGATIVO`.

Produto, tipo, quantidade, motivo e chave são obrigatórios. Motivo: 3–2000 caracteres; observações opcionais/null, até 2000. A quantidade representa a diferença, nunca o saldo final. Produto inativo, saldo insuficiente ou overflow retornam 409.

Entrada com lote novo ou recebimento adicional pelo mesmo código:

```json
{
  "produtoId": 6,
  "tipo": "ENTRADA_DOACAO",
  "quantidade": "12.000",
  "motivo": "Recebimento de suprimento demonstrativo",
  "lote": {"codigo": "LOTE-A", "validade": "2027-01-31"},
  "chaveOperacao": "f1410000-0000-4000-8000-000000000002"
}
```

Lote.codigo: 1–100 caracteres; validade: `YYYY-MM-DD` ou null. `lote` e `loteId` não podem ser usados juntos. Entradas e ajustes positivos podem criar lote ou selecionar lote existente. Saídas e ajustes negativos utilizam `loteId`, nunca criam um lote.

Saída por lote:

```json
{
  "produtoId": 6,
  "tipo": "SAIDA_CONSUMO",
  "quantidade": "2.000",
  "motivo": "Uso institucional registrado",
  "loteId": 1,
  "chaveOperacao": "f1410000-0000-4000-8000-000000000003"
}
```

Omitir lote significa movimentar exclusivamente quantidade sem lote. Não há FEFO, escolha automática ou divisão de uma saída entre vários lotes. Saída acima do saldo do lote/sem lote retorna 409, mesmo havendo saldo físico em outros lotes. Lote de outro produto/ONG retorna 404.

## Controle de validade

POST/PATCH do produto aceitam o novo campo opcional `controlaValidade` booleano; resposta retorna esse campo. Default false. Não se deduz obrigatoriedade pela categoria: alimentos e medicamentos podem ter exigências diferentes por produto.

Com `controlaValidade=true`, toda entrada/ajuste positivo exige lote com validade. Pode-se utilizar `loteId` de lote já datado. Sem lote ou sem validade retorna 400. A configuração só pode mudar antes da primeira movimentação; depois retorna 409 para preservar a rastreabilidade. Clientes F11.3 que omitem o campo continuam funcionando.

Validade é uma data civil no fuso configurado em `app.timezone` (atualmente UTC), sem conversão do campo para timestamp. O lote é válido durante todo o dia da validade. Vencido significa validade anterior ao dia corrente. `SAIDA_CONSUMO` de lote vencido retorna 409; perda, descarte e ajuste negativo justificados continuam permitidos. É permitido registrar entrada histórica de lote já vencido para conferência e descarte. Não há orientação médica nem geração de tarefas automáticas.

## Idempotência e concorrência

`chaveOperacao` é UUID obrigatório, exclusivo por ONG. O hash vincula produto, tipo, quantidade normalizada, motivo, observações, lote e funcionário. Repetição idêntica pelo mesmo funcionário retorna o movimento original com 200, sem alterar saldo; `25` e `25.000` são equivalentes. Mesma chave com conteúdo ou funcionário diferente retorna 409. Guarde a chave até conhecer o resultado; em falha de rede, repita o mesmo comando/chave. Não gere outra chave automaticamente para um resultado incerto.

O produto é bloqueado com `lockForUpdate` antes de ler o saldo. Há revalidação de atividade, unidade, lote e disponibilidade dentro da transação. A restrição UNIQUE no banco impede duplicidade mesmo em corridas entre produtos diferentes. Conflitos de unicidade são tratados após rollback; deadlocks têm até três tentativas nativas. Não há Redis, fila ou lock distribuído.

## Consultas e respostas

Histórico aceita filtros opcionais combináveis: `produtoId`, `tipo`, `loteId`, `responsavelId`, `de`, `ate`, `page`. Datas civis inclusivas, início não posterior ao fim. IDs de filtro precisam estar acessíveis à ONG. Filtros no banco antes da paginação, ID decrescente, relações carregadas antecipadamente. Sem filtros temporais, consulta todo o histórico paginado.

Movimento retorna objeto sem envelope:

```json
{
  "id": 1,
  "produto": {"id": 5, "nome": "Ração"},
  "tipo": "ENTRADA_COMPRA",
  "quantidade": "25.000",
  "unidade": {"id": 2, "codigo": "KG", "nome": "Quilograma", "sigla": "kg", "fracionavel": true},
  "saldoAnterior": "0.000",
  "saldoPosterior": "25.000",
  "motivo": "Recebimento físico conferido",
  "observacoes": null,
  "responsavel": {"id": 1, "nome": "Funcionário"},
  "lote": null,
  "chaveOperacao": "f1410000-0000-4000-8000-000000000001",
  "createdAt": "2026-11-19T22:00:00.000000Z"
}
```

Lote: `id`, `produtoId`, `codigo`, `validade` (civil/null), `quantidadeDisponivel`, `vencido`, `createdAt`. Nas consultas de alerta, inclui também `produto: {id,nome}`. Nunca retorna dados de autenticação ou hash do comando.

Paginação: envelopes Laravel `data`, `links`, `meta`. Lotes ordenados por ID crescente; alertas de validade por validade/ID. Não há carregamento de todos os lotes na listagem do catálogo.

Campos aditivos do produto: `estadoEstoque` (`ESGOTADO`, `BAIXO`, `REGULAR`), `possuiMovimentacoes`, `controlaValidade`. No GET individual, também `quantidadeSemLote` (string decimal) e `lotesDisponiveis` (quantidade de lotes com saldo positivo). Para ver lotes, usar o endpoint paginado específico. `estadoEstoque` expressa quantidade física, incluindo lotes vencidos; não significa autorização sanitária de consumo.

## Alertas

`GET /alertas?tipo=BAIXO|ESGOTADO|VENCIDO|PROXIMO_VENCIMENTO&page=1&dias=30`

Tipo obrigatório; dias opcional, inteiro 1–365, default 30, usado no próximo vencimento.

- BAIXO: produtos ativos com saldo >0 e <= mínimo. Retorna produtos.
- ESGOTADO: produtos ativos com saldo zero. `possuiMovimentacoes=false` identifica produto novo sem operação.
- VENCIDO: lotes de produtos ativos, saldo >0, validade anterior a hoje. Retorna lotes.
- PROXIMO_VENCIMENTO: lotes de produtos ativos, saldo >0, validade entre hoje e hoje+N dias, inclusive. Não inclui vencidos nem lotes sem data.

Não são notificações; o frontend consulta explicitamente cada categoria de alerta. Todas as consultas são institucionais e paginadas.

## Evidências locais — 19/11/2026

MySQL 8.4.13 local em Docker, saudável, `127.0.0.1:3309/patas_unidas_web`. Migrations aplicadas sem apagar registros. Produtos 1–4 e 32 lançamentos financeiros anteriores preservados. Dados novos identificados `F141-BACKEND`; senhas não são copiadas ao repositório.

Fluxos HTTP reais em servidores Laravel, login Sanctum/cookies/CSRF: ração produto 5, medicamento produto 6, concorrência produtos 7 e 8, produto 9 com controle explícito de validade. Entradas, saídas, ajuste, descarte vencido, alertas, histórico, leitura pelo veterinário e isolamento com administrador de outra ONG foram exercitados. Produto 7 pertence à primeira tentativa do instrumento de concorrência, interrompida por falta de acesso do usuário da aplicação a performance_schema; seus dados foram preservados. A observação de locks foi refeita usando o acesso administrativo local do container, sem ampliar permissões da aplicação.

Concorrência comprovada no produto 8 com dois servidores HTTP (8002 e 8003), sessões independentes e duas conexões ao MySQL. Uma terceira conexão reteve temporariamente o lock do produto, permitindo observar ambas as requisições esperando em `performance_schema.data_lock_waits`, antes de liberar o lock:

- Saldo 10, duas saídas de 8: HTTP 409 e 201; saldo 2; exatamente uma saída persistida.
- Duas entradas de 1: ambas HTTP 201; saldo 4.
- Duas entradas idênticas de 1, mesmo funcionário/chave: HTTP 201 e 200; saldo 5; apenas uma entrada adicional.

Saldos de todos os produtos e lotes foram comparados ao somatório exato de suas movimentações via Decimal, sem float. Financeiro permaneceu com 32 registros. Evidências operacionais locais: `/tmp/f141-results.json`; scripts `/tmp/f141-concurrent.py` e `/tmp/f141-final-http.py`. Esses arquivos não contêm credenciais, mas leem os arquivos restritos existentes fora do repositório. Não integram a suíte padrão nem garantem disponibilidade após limpeza de `/tmp`.

## Orientações para F11.4.2

Usar saldo retornado pelo servidor; não calcular saldo autoritativo no React. Separar entradas/saídas de ajustes por perfil. Selecionar lote explicitamente e mostrar validade, saldo por lote e quantidade sem lote. Preservar strings decimais de três casas. Uma ação gera um UUID, reutilizado em retry. Atualizar produto, histórico, lotes e alertas após operação confirmada. Tratar 400 por campo, 403, 404 e 409 de forma contextual. Não oferecer edição/exclusão de movimentação, saldo direto, integração financeira, FEFO, transferência ou conversão de unidades.

## Regressão final

- PHPUnit completo: **195 testes, 1.570 assertions, nenhuma falha**; sete testes novos de movimentação (104 assertions), incluindo rollback por falha de persistência.
- Pint executado; sintaxe PHP dos arquivos de estoque verificada; 21 rotas do módulo registradas; migrations dos lotes/movimentos e controle de validade aplicadas nos batches 16 e 17.
- `git diff --check` aprovado. Nenhum arquivo frontend foi alterado nesta subfase. Nenhum commit criado.
- Evidência HTTP registrada contém 23 operações, códigos 200/201/400/403/404/409, além dos comandos simultâneos descritos acima. O primeiro conjunto de preparação HTTP também foi persistido e conferido, mas sua lista em memória foi perdida com a interrupção do instrumento inicial; não é apresentado como log completo de requisições.
- Estado final dos produtos próprios: 5 = 17.001; 6 = 12.000; 7 = 2.000; 8 = 5.000; 9 = 0.000. Total de 18 movimentações e três lotes. Os nove saldos totais e os três saldos de lote conferem com o histórico; produtos anteriores 1–4 continuam em 0.000.

Não houve teste de carga, navegador ou implementação React nesta subfase exclusivamente backend. A concorrência cobriu saídas, entradas e idempotência no mesmo produto; não representa cobertura exaustiva de todas as intercalações possíveis.
