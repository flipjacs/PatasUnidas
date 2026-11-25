# F11.2.1: contrato de análise de despesas

## Consulta privada

`GET /api/v1/ong/relatorios/financeiro/analise-despesas?de=2026-01-01&ate=2026-11-18`

Somente administrador ativo de ONG ativa, pela sessão Sanctum. A Policy é a mesma do relatório financeiro interno. A ONG vem da sessão; parâmetros adicionais (inclusive `ong_id`) são rejeitados. Voluntários não recebem acesso. O relatório anterior `/ong/relatorios/financeiro` mantém seu contrato e seu custo de consulta.

## Período

- `de` e `ate`: datas civis `YYYY-MM-DD`, inclusivas, sem conversão para UTC no contrato.
- Quando omitidos individualmente: `de` usa 1º de janeiro do ano corrente; `ate` usa a data atual da aplicação.
- `de <= ate`; intervalo máximo de 1095 dias. Datas e parâmetros inválidos retornam HTTP 400, conforme padrão existente.
- Pago: estado atual `REALIZADA`, por `confirmado_em` (pagamento).
- Aprovado: estado atual `APROVADA`, por `aprovado_em` (ainda não pago).
- Pendente: estado atual `PENDENTE`, por `created_at`.
- Receitas e despesas canceladas ficam excluídas. Não é uma reconstrução dos estados históricos em uma data passada.
- Cada lançamento entra somente no seu estado atual e dentro do período da data correspondente. Datas de criação não substituem datas ausentes de pagamento/aprovação.

## Resposta

```ts
type CategoryExpense = {
  categoriaId: number | null;
  nome: string;
  global: boolean | null;
  ativo: boolean | null;
  totalPago: string;
  quantidade: number;
};
type ExpenseAnalysis = {
  periodo: { de: string; ate: string };
  criteriosTemporais: {
    pago: 'confirmado_em'; pendente: 'created_at'; aprovado: 'aprovado_em';
  };
  indicadores: {
    totalPago: string; quantidadePago: number;
    totalPendente: string; quantidadePendente: number;
    totalAprovado: string; quantidadeAprovado: number;
    quantidadeDespesas: number;
    totalPagoSemCategoria: string;
    categoriaMaiorGasto: CategoryExpense | null;
  };
  categorias: CategoryExpense[];
  meses: {
    competencia: string; // YYYY-MM, crescente
    totalPago: string; totalPendente: string; totalAprovado: string;
    quantidade: number;
  }[];
};
```

`categorias` contém apenas grupos com despesas pagas no período, ordenados pelo total pago decrescente, com desempate pelo ID. Inativas continuam presentes. Grupo sem vínculo estruturado: `categoriaId`, `global` e `ativo` nulos, nome `Não categorizado`. Não se deduz categoria pelo campo textual legado; Outros é um grupo distinto. O indicador de maior gasto pode ser o grupo Não categorizado; sem pagamentos, é nulo.

`quantidadeDespesas` e a quantidade mensal somam os registros dos três estados incluídos, cada um segundo sua data. `totalPagoSemCategoria` refere-se somente aos pagamentos. Todos os meses entre as extremidades do período são retornados, mesmo sem dados. Meses nas extremidades respeitam os dias exatos solicitados.

Dinheiro usa strings decimais com duas casas (`"12.34"`). Não há percentuais nesta fase. Somatórios são SQL sobre DECIMAL, convertidos em centavos inteiros para composição dos totais e formatação. A série é preenchida em PHP a partir de resultados já agregados, nunca dos lançamentos individuais.

## Consultas e integração

São quatro agregações SQL, constantes com relação ao número de categorias e meses: uma distribuição por categoria e três agrupamentos mensais por estado. SQLite usa `strftime`, MySQL usa `DATE_FORMAT`. As consultas executam em transação de leitura; no MySQL local, REPEATABLE READ permite um snapshot consistente. Os índices institucionais existentes são reutilizados; nenhuma migration foi necessária.

Validação local de 18/11/2026: seis despesas IDs 27–32 criadas pelos endpoints e transições existentes, marcador `F121-BACKEND`. Pagos: 10.10 + 20.20 + 3.03 = 33.33; pendente: 5.05; aprovada: 7.07; cancelada: 99.99 excluída. Totais da ONG A passaram de 49.40/19.59/0.00 para 82.73/24.64/7.07 (pago/pendente/aprovado). ONG B retornou total pago 0.00. Registros anteriores preservados.

A F11.2.2 deve consumir os agregados diretamente, manter o período retornado explícito e distinguir os três critérios temporais. Nenhum gráfico, snapshot público ou fluxo de pagamento foi alterado.
