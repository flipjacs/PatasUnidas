<?php

namespace App\Services;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class FinancialSummaryService
{
    private const TOTALS = [
        'receitasRealizadas' => ['RECEITA', 'REALIZADA', 'confirmado_em'],
        'despesasRealizadas' => ['DESPESA', 'REALIZADA', 'confirmado_em'],
        'receitasPendentes' => ['RECEITA', 'PENDENTE', 'created_at'],
        'despesasPendentes' => ['DESPESA', 'PENDENTE', 'created_at'],
        'despesasAprovadas' => ['DESPESA', 'APROVADA', 'aprovado_em'],
    ];

    private function inPeriod(Builder $query, array $period, string $field): Builder
    {
        if (isset($period['de'])) {
            $query->where($field, '>=', $period['de'].' 00:00:00');
        }
        if (isset($period['ate'])) {
            $query->where($field, '<', Carbon::parse($period['ate'])->addDay()->toDateString().' 00:00:00');
        }

        return $query;
    }

    public function money(int $cents): string
    {
        $positive = abs($cents);

        return ($cents < 0 ? '-' : '').intdiv($positive, 100).'.'.str_pad((string) ($positive % 100), 2, '0', STR_PAD_LEFT);
    }

    public function summary(int $ongId, array $period): array
    {
        $expressions = [];
        $bindings = [];
        foreach (self::TOTALS as $name => [$type, $status, $field]) {
            $condition = 'tipo = ? AND status = ?';
            array_push($bindings, $type, $status);
            if (isset($period['de'])) {
                $condition .= " AND {$field} >= ?";
                $bindings[] = $period['de'].' 00:00:00';
            }
            if (isset($period['ate'])) {
                $condition .= " AND {$field} < ?";
                $bindings[] = Carbon::parse($period['ate'])->addDay()->toDateString().' 00:00:00';
            }
            $expressions[] = "COALESCE(ROUND(SUM(CASE WHEN {$condition} THEN valor ELSE 0 END) * 100, 0), 0) AS {$name}";
        }
        $totals = DB::table('financial_transactions')->where('ong_id', $ongId)
            ->selectRaw(implode(', ', $expressions), $bindings)->first();

        $result = [];
        foreach (array_keys(self::TOTALS) as $name) {
            $result[$name] = $this->money((int) $totals->{$name});
        }
        $result['saldoRealizado'] = $this->money((int) $totals->receitasRealizadas - (int) $totals->despesasRealizadas);

        return $result;
    }

    public function categories(int $ongId, array $period): array
    {
        $query = DB::table('financial_transactions')->where('ong_id', $ongId)->where('status', 'REALIZADA');
        $rows = $this->inPeriod($query, $period, 'confirmado_em')
            ->select('tipo', 'categoria')->selectRaw('ROUND(SUM(valor) * 100, 0) AS cents')
            ->groupBy('tipo', 'categoria')->orderBy('tipo')->orderBy('categoria')->get();

        $categories = ['receitasPorCategoria' => [], 'despesasPorCategoria' => []];
        foreach ($rows as $row) {
            $key = $row->tipo === 'RECEITA' ? 'receitasPorCategoria' : 'despesasPorCategoria';
            $categories[$key][$row->categoria] = $this->money((int) $row->cents);
        }

        return $categories;
    }

    public function movementCount(int $ongId, array $period): int
    {
        return $this->inPeriod(DB::table('financial_transactions')->where('ong_id', $ongId), $period, 'created_at')->count();
    }

    public function publicSnapshot(int $ongId, string $start, string $end): array
    {
        $rows = $this->inPeriod(
            DB::table('financial_transactions')->where('ong_id', $ongId)->where('status', 'REALIZADA'),
            ['de' => $start, 'ate' => $end],
            'confirmado_em'
        )->select('tipo', 'categoria')
            ->selectRaw('COUNT(*) AS quantidade, ROUND(SUM(valor) * 100, 0) AS cents')
            ->groupBy('tipo', 'categoria')->orderBy('tipo')->orderBy('categoria')->get();

        $revenue = 0;
        $expenses = 0;
        $count = 0;
        $categories = ['receitasPorCategoria' => [], 'despesasPorCategoria' => []];
        foreach ($rows as $row) {
            $cents = (int) $row->cents;
            $count += (int) $row->quantidade;
            if ($row->tipo === 'RECEITA') {
                $revenue += $cents;
                $categories['receitasPorCategoria'][$row->categoria] = $this->money($cents);
            } else {
                $expenses += $cents;
                $categories['despesasPorCategoria'][$row->categoria] = $this->money($cents);
            }
        }

        return [
            'receitasRealizadas' => $this->money($revenue),
            'despesasRealizadas' => $this->money($expenses),
            'resultadoLiquido' => $this->money($revenue - $expenses),
            ...$categories,
            'quantidadeMovimentacoes' => $count,
        ];
    }
}
