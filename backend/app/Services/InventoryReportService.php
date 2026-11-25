<?php

namespace App\Services;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class InventoryReportService
{
    private const TYPES = ['ENTRADA_COMPRA', 'ENTRADA_DOACAO', 'ENTRADA_DEVOLUCAO', 'SAIDA_CONSUMO', 'SAIDA_PERDA', 'SAIDA_DESCARTE', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'];

    private function products(int $ongId, array $filters): Builder
    {
        $query = DB::table('inventory_products as p')->where('p.ong_id', $ongId);
        foreach (['categoriaId' => 'categoria_id', 'produtoId' => 'id', 'unidadeId' => 'unidade_id'] as $key => $column) {
            if (isset($filters[$key])) {
                $query->where('p.'.$column, $filters[$key]);
            }
        }

        return $query;
    }

    private function movements(int $ongId, array $filters): Builder
    {
        return $this->products($ongId, $filters)->join('inventory_movements as m', function ($join): void {
            $join->on('m.produto_id', '=', 'p.id')->on('m.ong_id', '=', 'p.ong_id');
        })->where('m.created_at', '>=', $filters['de'].' 00:00:00')
            ->where('m.created_at', '<', Carbon::parse($filters['ate'])->addDay()->toDateString().' 00:00:00');
    }

    private function counts(Builder $query): Builder
    {
        $query->selectRaw('COUNT(*) AS total, COUNT(DISTINCT m.produto_id) AS produtos');
        foreach (self::TYPES as $type) {
            $query->selectRaw("COALESCE(SUM(CASE WHEN m.tipo = ? THEN 1 ELSE 0 END), 0) AS {$type}", [$type]);
        }

        return $query;
    }

    private function countData(?object $row): array
    {
        $types = [];
        foreach (self::TYPES as $type) {
            $types[$type] = (int) ($row->{$type} ?? 0);
        }

        return [
            'totalOperacoes' => (int) ($row->total ?? 0), 'produtosDistintos' => (int) ($row->produtos ?? 0),
            'entradas' => $types['ENTRADA_COMPRA'] + $types['ENTRADA_DOACAO'] + $types['ENTRADA_DEVOLUCAO'],
            'saidas' => $types['SAIDA_CONSUMO'] + $types['SAIDA_PERDA'] + $types['SAIDA_DESCARTE'],
            'ajustes' => $types['AJUSTE_POSITIVO'] + $types['AJUSTE_NEGATIVO'], 'porTipo' => $types,
        ];
    }

    /** SQLite stores decimal values with numeric affinity; aggregate exact stored thousandths as integers. */
    private function sum(string $expression): string
    {
        return DB::connection()->getDriverName() === 'sqlite'
            ? "COALESCE(SUM(CAST(ROUND(({$expression}) * 1000, 0) AS INTEGER)), 0)"
            : "COALESCE(SUM({$expression}), 0)";
    }

    private function quantity(mixed $value): string
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return InventoryMovementService::decimal((int) $value);
        }
        [$whole, $fraction] = array_pad(explode('.', (string) $value, 2), 2, '');

        return $whole.'.'.str_pad($fraction, 3, '0');
    }

    private function category(object $row): array
    {
        return ['id' => (int) $row->categoria_id, 'nome' => $row->categoria_nome, 'ativo' => (bool) $row->categoria_ativo, 'global' => $row->categoria_ong === null];
    }

    private function unit(object $row): array
    {
        return ['id' => (int) $row->unidade_id, 'codigo' => $row->unidade_codigo, 'sigla' => $row->unidade_sigla];
    }

    private function consumption(int $ongId, array $filters): Builder
    {
        return $this->movements($ongId, $filters)->where('m.tipo', 'SAIDA_CONSUMO')
            ->join('inventory_categories as c', function ($join) use ($ongId): void {
                $join->on('c.id', '=', 'p.categoria_id')->where(fn ($q) => $q->whereNull('c.ong_id')->orWhere('c.ong_id', $ongId));
            })->join('inventory_units as u', 'u.id', '=', 'm.unidade_id')
            ->select('c.id as categoria_id', 'c.nome as categoria_nome', 'c.ativo as categoria_ativo', 'c.ong_id as categoria_ong', 'u.id as unidade_id', 'u.codigo as unidade_codigo', 'u.sigla as unidade_sigla')
            ->selectRaw($this->sum('m.quantidade').' AS quantidade, COUNT(*) AS operacoes, COUNT(DISTINCT p.id) AS produtos')
            ->groupBy('c.id', 'c.nome', 'c.ativo', 'c.ong_id', 'u.id', 'u.codigo', 'u.sigla');
    }

    public function analyze(int $ongId, array $filters): array
    {
        $reference = now()->toImmutable();
        $today = $reference->toDateString();
        $near = $reference->addDays(30)->toDateString();
        $catalog = $this->products($ongId, $filters)->selectRaw('COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN p.ativo = 1 THEN 1 ELSE 0 END), 0) AS ativos,
            COALESCE(SUM(CASE WHEN p.ativo = 0 THEN 1 ELSE 0 END), 0) AS inativos,
            COALESCE(SUM(CASE WHEN p.ativo = 1 AND p.quantidade_disponivel > 0 THEN 1 ELSE 0 END), 0) AS comSaldo,
            COALESCE(SUM(CASE WHEN p.ativo = 1 AND p.quantidade_disponivel = 0 THEN 1 ELSE 0 END), 0) AS esgotados,
            COALESCE(SUM(CASE WHEN p.ativo = 1 AND p.quantidade_disponivel > 0 AND p.quantidade_disponivel <= p.quantidade_minima THEN 1 ELSE 0 END), 0) AS estoqueBaixo')->first();
        $movements = $this->countData($this->counts($this->movements($ongId, $filters))->first());
        $expression = DB::connection()->getDriverName() === 'sqlite' ? "strftime('%Y-%m', m.created_at)" : "DATE_FORMAT(m.created_at, '%Y-%m')";
        $monthly = $this->counts($this->movements($ongId, $filters))->selectRaw("{$expression} AS competencia")->groupByRaw($expression)->get()->keyBy('competencia');
        $months = [];
        $end = Carbon::parse($filters['ate'])->startOfMonth();
        for ($month = Carbon::parse($filters['de'])->startOfMonth(); $month->lte($end); $month->addMonth()) {
            $key = $month->format('Y-m');
            $months[] = ['competencia' => $key, ...$this->countData($monthly->get($key))];
        }
        $consumption = $this->consumption($ongId, $filters)->orderBy('c.id')->orderBy('u.id')->get()->map(fn ($row) => [
            'categoria' => $this->category($row), 'unidade' => $this->unit($row), 'quantidadeConsumida' => $this->quantity($row->quantidade),
            'operacoes' => (int) $row->operacoes, 'produtosDistintos' => (int) $row->produtos,
        ])->all();
        $ranking = $this->consumption($ongId, $filters)->addSelect('p.id as produto_id', 'p.nome as produto_nome', 'p.ativo as produto_ativo')->groupBy('p.id', 'p.nome', 'p.ativo')
            ->orderByDesc('operacoes')->orderBy('p.id')->limit($filters['limiteRanking'] ?? 10)->get()->map(fn ($row) => [
                'produtoId' => (int) $row->produto_id, 'nome' => $row->produto_nome, 'ativo' => (bool) $row->produto_ativo,
                'categoria' => $this->category($row), 'unidade' => $this->unit($row),
                'quantidadeConsumida' => $this->quantity($row->quantidade), 'operacoes' => (int) $row->operacoes,
            ])->all();
        $lots = $this->products($ongId, $filters)->where('p.ativo', true)->join('inventory_lots as l', function ($join): void {
            $join->on('l.produto_id', '=', 'p.id')->on('l.ong_id', '=', 'p.ong_id');
        })->where('l.quantidade_disponivel', '>', 0);
        $expiry = (clone $lots)->selectRaw('COUNT(CASE WHEN l.validade < ? THEN 1 END) AS lotesVencidos,
            COUNT(DISTINCT CASE WHEN l.validade < ? THEN p.id END) AS produtosComLotesVencidos,
            COUNT(CASE WHEN l.validade BETWEEN ? AND ? THEN 1 END) AS lotesProximos,
            COUNT(DISTINCT CASE WHEN l.validade BETWEEN ? AND ? THEN p.id END) AS produtosComLotesProximos', [$today, $today, $today, $near, $today, $near])->first();
        $quantities = (clone $lots)->join('inventory_units as u', 'u.id', '=', 'p.unidade_id')
            ->select('u.id as unidade_id', 'u.codigo as unidade_codigo', 'u.sigla as unidade_sigla');
        foreach (['vencida' => ['l.validade < ?', [$today]], 'proxima' => ['l.validade BETWEEN ? AND ?', [$today, $near]], 'validaAposJanela' => ['l.validade > ?', [$near]], 'semValidade' => ['l.validade IS NULL', []]] as $key => [$condition, $bindings]) {
            $quantities->selectRaw($this->sum("CASE WHEN {$condition} THEN l.quantidade_disponivel ELSE 0 END")." AS {$key}", $bindings);
        }
        $byUnit = $quantities->groupBy('u.id', 'u.codigo', 'u.sigla')->orderBy('u.id')->get()->map(fn ($row) => [
            'unidade' => $this->unit($row), 'vencida' => $this->quantity($row->vencida), 'proxima' => $this->quantity($row->proxima),
            'validaAposJanela' => $this->quantity($row->validaAposJanela), 'semValidade' => $this->quantity($row->semValidade),
        ])->all();

        return [
            'periodo' => ['de' => $filters['de'], 'ate' => $filters['ate']],
            'referencias' => ['estoqueEm' => $reference->toIso8601String(), 'validadeEm' => $today, 'proximosDias' => 30, 'campoMovimentacao' => 'created_at', 'fusoHorario' => config('app.timezone'), 'classificacao' => 'CATEGORIA_ATUAL_DO_PRODUTO'],
            'filtros' => ['categoriaId' => isset($filters['categoriaId']) ? (int) $filters['categoriaId'] : null, 'produtoId' => isset($filters['produtoId']) ? (int) $filters['produtoId'] : null, 'unidadeId' => isset($filters['unidadeId']) ? (int) $filters['unidadeId'] : null, 'limiteRanking' => (int) ($filters['limiteRanking'] ?? 10)],
            'catalogo' => array_map('intval', (array) $catalog), 'movimentacoes' => $movements,
            'consumoPorCategoria' => $consumption, 'ranking' => ['criterio' => 'FREQUENCIA_SAIDAS_CONSUMO', 'itens' => $ranking], 'meses' => $months,
            'validade' => [...array_map('intval', (array) $expiry), 'quantidadesPorUnidade' => $byUnit],
        ];
    }
}
