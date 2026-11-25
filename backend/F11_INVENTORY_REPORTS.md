# F11.6.1 — Relatórios e indicadores operacionais de estoque

## A. Diagnóstico e escopo

O catálogo existente usa `inventory_products`, categorias obrigatórias, unidades imutáveis após a primeira movimentação e saldo materializado `DECIMAL(12,3)`. O histórico imutável está em `inventory_movements`, e os lotes em `inventory_lots`. Este incremento é somente leitura: não altera saldos, transições, integração financeira, autenticação ou contratos anteriores. Não há migration nova.

## B. Referências temporais

- `periodo.de` / `periodo.ate`: intervalo inclusivo de **movimentações**, pelo `inventory_movements.created_at` persistido.
- Sem datas: primeiro dia do ano corrente até hoje. Máximo: diferença de 1095 dias entre limites. Se apenas um limite for enviado, o outro recebe seu padrão; intervalo invertido é inválido.
- Datas civis `YYYY-MM-DD`; consulta usa início inclusivo e início do dia seguinte ao fim exclusivo, preservando frações de segundo.
- `referencias.estoqueEm`: instante da consulta; `referencias.validadeEm`: data civil atual. Catálogo/validade **não representam saldo histórico** e não são limitados por `de`/`ate`.
- O aplicativo atualmente utiliza `UTC`; `referencias.fusoHorario` explicita essa configuração. Competências usam diretamente o mês do timestamp persistido, no mesmo fuso da aplicação e das demais consultas existentes. Não há conversão implícita para o fuso do navegador.
- `referencias.classificacao = CATEGORIA_ATUAL_DO_PRODUTO`: categoria/nome atuais são utilizados mesmo no histórico. Renomeação/reclassificação posterior afeta sua apresentação. Não existem snapshots retroativos da classificação.

## C. Catálogo e produtos críticos

`catalogo.total` inclui ativos e inativos, sem duplicação por lotes ou movimentos. `ativos` e `inativos` são separados. Disponibilidade (`comSaldo`, `esgotados`, `estoqueBaixo`) considera somente ativos, alinhada aos alertas:

- `comSaldo`: saldo > 0, inclui produtos baixos.
- `esgotados`: saldo = 0.
- `estoqueBaixo`: saldo > 0 e saldo <= mínimo; não inclui esgotados.

A listagem crítica combina esgotados e baixos, pagina 15 no banco e ordena esgotados primeiro, depois ID crescente. Essa fila priorizada evita exigir que o cliente junte duas páginas independentes da API de alertas. Os endpoints de alertas anteriores continuam intactos.

## D. Movimentações

`movimentacoes` e cada item de `meses` incluem contagens inteiras de operações:

| Campo | Tipos incluídos |
|---|---|
| entradas | ENTRADA_COMPRA, ENTRADA_DOACAO, ENTRADA_DEVOLUCAO |
| saidas | SAIDA_CONSUMO, SAIDA_PERDA, SAIDA_DESCARTE |
| ajustes | AJUSTE_POSITIVO, AJUSTE_NEGATIVO |
| totalOperacoes | Todos os oito tipos |
| produtosDistintos | Produtos únicos movimentados naquele intervalo/competência |
| porTipo | As oito chaves acima, cada uma com sua contagem |

Uma entrada de 50 kg conta como **uma operação**. `produtosDistintos` mensal não deve ser somado para reconstruir o total do período.

## E. Consumo por categoria e unidade

`consumoPorCategoria` considera somente `SAIDA_CONSUMO`, agrupando por ID da categoria e ID da unidade. Retorna apenas grupos com consumo, ordenados por categoria/unidade. Inclui produtos e categorias inativos com histórico. Categoria obrigatória: não existe grupo artificial “Não categorizado”.

Cada grupo contém `categoria`, `unidade`, `quantidadeConsumida` (string de três casas), `operacoes` e `produtosDistintos`. Não há total físico global: kg, g, doses e caixas permanecem separados, sem conversão. Mesmo uma soma na mesma categoria/unidade é uma agregação operacional de materiais, não uma medida universal de utilização.

## F. Ranking

`ranking.criterio = FREQUENCIA_SAIDAS_CONSUMO`. Ordenação por número de operações de consumo decrescente, desempate por ID do produto crescente. Não compara quantidades físicas de unidades incompatíveis. Quantidade e unidade são exibidas apenas como informações do produto. Inclui produtos inativos. Limite padrão 10, mínimo 1 e máximo 20; filtro `unidadeId` opcional.

## G. Evolução mensal

`meses` contém competências `YYYY-MM` em ordem crescente, inclusive meses sem movimentação com todas as contagens zeradas. Primeiro/último mês respeitam os dias efetivamente solicitados; não extrapolam para o mês inteiro. Não há soma física entre unidades na série.

## H. Validade atual

Somente produtos ativos e lotes com quantidade positiva:

- Vencido: validade < hoje.
- Próximo: validade entre hoje e hoje + 30 dias, ambos inclusivos. Lote que vence hoje continua válido durante esse dia civil.
- `lotesVencidos`, `lotesProximos`: quantidade de lotes.
- `produtosComLotesVencidos`, `produtosComLotesProximos`: produtos distintos em cada situação. Um produto pode constar nos dois indicadores se possuir lotes diferentes.
- `quantidadesPorUnidade`: separa `vencida`, `proxima`, `validaAposJanela` (após os 30 dias) e `semValidade` por unidade.

Não classifica o saldo integral do produto como vencido. Quantidade sem lote não integra as quantidades de lotes; estas não pretendem reconstruir todo o saldo do catálogo. Lotes vazios e produtos inativos não geram alertas.

## I–J. API e filtros

Base `/api/v1/ong/estoque/relatorios`.

| Método / caminho | Finalidade | Filtros |
|---|---|---|
| GET `/resumo` | Resumo consolidado, consumo, ranking, meses e validade | de, ate, categoriaId, produtoId, unidadeId, limiteRanking |
| GET `/produtos-criticos` | Fila atual priorizada e paginada | categoriaId, produtoId, unidadeId, page |

IDs são inteiros positivos. Categoria pode ser global ou da própria ONG, inclusive inativa. Produto inativo pode ser selecionado no resumo histórico. IDs externos/inexistentes de categoria/produto retornam **404**; unidade inválida retorna **400**, conforme validação existente. Filtros são combinados com AND: categoria/produto válidos mas incompatíveis retornam conjunto vazio. Todos os blocos, inclusive estoque atual/validade, obedecem aos três filtros de referência. Período limita apenas histórico. Campos não documentados são rejeitados; `de`/`ate` não se aplicam à fila crítica.

Resposta de `/resumo` não possui envelope `data`, conforme relatórios existentes. Estrutura TypeScript:

```ts
type Unit = { id: number; codigo: string; sigla: string };
type Category = { id: number; nome: string; ativo: boolean; global: boolean };
type Counts = {
  totalOperacoes: number; produtosDistintos: number;
  entradas: number; saidas: number; ajustes: number;
  porTipo: Record<
    'ENTRADA_COMPRA' | 'ENTRADA_DOACAO' | 'ENTRADA_DEVOLUCAO' |
    'SAIDA_CONSUMO' | 'SAIDA_PERDA' | 'SAIDA_DESCARTE' |
    'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO', number>;
};
type StockReport = {
  periodo: { de: string; ate: string };
  referencias: {
    estoqueEm: string; validadeEm: string; proximosDias: 30;
    campoMovimentacao: 'created_at'; fusoHorario: string;
    classificacao: 'CATEGORIA_ATUAL_DO_PRODUTO';
  };
  filtros: { categoriaId: number | null; produtoId: number | null;
    unidadeId: number | null; limiteRanking: number };
  catalogo: { total: number; ativos: number; inativos: number;
    comSaldo: number; esgotados: number; estoqueBaixo: number };
  movimentacoes: Counts;
  consumoPorCategoria: Array<{
    categoria: Category; unidade: Unit; quantidadeConsumida: string;
    operacoes: number; produtosDistintos: number;
  }>;
  ranking: { criterio: 'FREQUENCIA_SAIDAS_CONSUMO'; itens: Array<{
    produtoId: number; nome: string; ativo: boolean;
    categoria: Category; unidade: Unit;
    quantidadeConsumida: string; operacoes: number;
  }> };
  meses: Array<Counts & { competencia: string }>;
  validade: {
    lotesVencidos: number; produtosComLotesVencidos: number;
    lotesProximos: number; produtosComLotesProximos: number;
    quantidadesPorUnidade: Array<{ unidade: Unit; vencida: string;
      proxima: string; validaAposJanela: string; semValidade: string }>;
  };
};
```

Exemplo: `GET /api/v1/ong/estoque/relatorios/resumo?de=2026-01-01&ate=2026-11-19&produtoId=18` retorna ranking de frequência e `quantidadeConsumida: "5.126"` em `KG`, no cenário demonstrativo abaixo. A data final deve ser ajustada à data das movimentações no ambiente consultado.

`/produtos-criticos` utiliza o envelope Laravel `data`, `links`, `meta`. Cada item tem `id`, `nome`, `categoria: {id,nome,ativo}`, `unidade`, `quantidadeDisponivel`, `quantidadeMinima`, `estadoEstoque: ESGOTADO | BAIXO`. Strings decimais com três casas. Não inclui custos ou detalhes financeiros.

Erros: **401** não autenticado/inativo, **403** perfil ou ONG sem autorização, **404** referência externa/inexistente, **400** validação (padrão deste backend). Não existe operação de escrita nos novos endpoints.

## K. Precisão

MySQL agrega diretamente `SUM(DECIMAL)`; normalização para string não converte para float. SQLite não possui armazenamento DECIMAL nativo: transforma cada valor já persistido com precisão de três casas em milésimos inteiros dentro do SQL e soma esses inteiros. O ROUND nessa compatibilidade recupera os milésimos existentes, sem reduzir a precisão de entrada. Retorno usa o helper decimal inteiro do serviço existente. Contagens são inteiros; não existem percentuais ou valores monetários.

## L. Desempenho

Resumo: **sete consultas agregadas**, independentes da quantidade de produtos/movimentações: catálogo, movimentos, meses, consumo, ranking, contagem de validade e quantidade de validade por unidade. Consultas adicionais limitadas a autenticação/Policy/validação de filtros. Sem consulta por categoria/produto/mês; apenas resultados agregados e meses zerados são tratados em PHP. Ranking limitado e fila crítica paginada com eager loading de categoria/unidade.

Usa os índices existentes de movimentos `(ong_id, created_at)` e `(produto_id, id)`, produtos `(ong_id, ativo, nome)` / `(ong_id, categoria_id)` e lotes `(ong_id, validade)`. Nenhum índice/migration adicional sem necessidade demonstrada. Não foi realizado benchmark de carga. Teste automatizado confirmou sete consultas de agregação e quantidade total constante com 1 e 16 produtos históricos. Resumo executa transação curta somente de leitura; no MySQL local usa o isolamento padrão REPEATABLE READ para os agregados da mesma resposta.

Meses: `DATE_FORMAT` no MySQL e `strftime` no SQLite; diferença encapsulada no serviço, sem camada adicional de infraestrutura.

## M. Segurança

`auth:web`, middleware de conta ativa e `InventoryProductPolicy::viewAny` existentes. Administrador, voluntário e veterinário podem consultar com ONG ativa. Usuário público/criador não têm acesso institucional. ONG vem exclusivamente da sessão. Cada consulta limita produtos e joins de movimentações/lotes pela mesma ONG. Categorias customizadas externas são rejeitadas antes da consulta. Não retorna despesas, custos, doadores, responsáveis ou outros dados financeiros/pessoais.

## N–O. Validação e MySQL real

Cenário HTTP real local com Sanctum/cookies/CSRF, MySQL 8.4.13, banco `patas_unidas_web` em Docker saudável. Marcador `F161-BACKEND`:

| Produto | Unidade | Consumo | Saldo final | Operações |
|---|---|---|---|---|
| 18 Ração kg | kg | 5.126 | 3.873 (baixo) | 7 |
| 19 Medicamento doses | dose | 2.000 | 12.000 | 4 |
| 20 Materiais caixas | caixa | 1.000 | 3.000 | 2 |
| 21 Produto esgotado | unidade | 0.000 | 0.000 | 0 |
| 22 Isolamento B | unidade | 0.000 | 8.000 | 1, em outra ONG |

Produto 18: compra 10.000; consumo 2.125 + 3.001; perda 1.000; descarte 1.000; ajuste positivo 1.000 e negativo 0.001. Produto 19: doações físicas em lote válido 10 e vencido 5; consumo 2 do válido; descarte 1 do vencido. Resultado: **8 doses próximas e 4 vencidas**, não 12 vencidas. Produto 20: devolução 4, consumo 1.

37 operações HTTP verificadas: cadastros/movimentos 201; relatórios e consultas dos três perfis 200; público 403; produto externo 404 nos dois sentidos; período inválido 400; período histórico vazio com estoque atual preservado. Totais e saldos conferidos contra registros MySQL usando `Decimal` no cliente de verificação. Logs temporários sem segredos em `/tmp/f161-results.json` (artefato local, não contrato público).

A suíte `InventoryReportTest` cobre também categorias customizadas inativas, datas inclusivas, meses vazios, precisão 0.101 + 0.202, lotes múltiplos, validade hoje/30 dias/31 dias, lotes vazios, paginação, filtro externo, perfis, conta inativa, ONG suspensa e consultas constantes. A regressão completa cobre catálogo, locking/idempotência, integração financeira e demais módulos anteriores. Resultado final: **208 testes / 1.794 assertions, nenhuma falha**; cinco novos testes / 86 assertions. Pint, sintaxe dos seis arquivos PHP, rotas, migrations e `git diff --check` aprovados. MySQL confirmou REPEATABLE READ, sessão SYSTEM e fuso do servidor UTC. Frontend não modificado nesta subfase.

## P. Compatibilidade e preservação

Nenhuma alteração em frontend, financeiro, saldos ou migrations. Comparação antes/depois preservou os 17 produtos, 41 movimentos e 6 lotes anteriores, todos os 39 lançamentos financeiros e contagens de adoções/prontuários/doações. Novos dados criados somente pelos endpoints legítimos de estoque. Cinco produtos e 14 movimentos demonstrativos mantidos, sem remoção dos anteriores.

## Q. Arquivos desta subfase

- `routes/api.php` — duas rotas protegidas aditivas.
- `app/Http/Controllers/InventoryReportController.php` — resumo transacional somente leitura/fila crítica.
- `app/Http/Requests/InventoryReportRequest.php` — Policy, período, limites e referências isoladas.
- `app/Http/Resources/InventoryCriticalProductResource.php` — contrato reduzido e sem dados privados.
- `app/Services/InventoryReportService.php` — sete agregações e compatibilidade de dialeto.
- `tests/Feature/InventoryReportTest.php` — regressão semântica e autorização.
- `F11_INVENTORY_REPORTS.md` — contrato e evidências.

## R–S. Continuidade F11.6.2

Não há bloqueio conhecido para consumir os dois endpoints. O frontend deve rotular disponibilidade como **atual**, histórico pelo período e ranking como **frequência de consumo**; manter unidades visíveis; nunca reconstruir totais somando páginas. Produtos críticos paginam separadamente. Não somar contagens distintas mensais ou quantidades incompatíveis. Não apresentar estoque valorizado ou dados financeiros. As telas/gráficos da F11.6.2 não foram iniciados.
