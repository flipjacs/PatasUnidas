<?php

namespace App\Services;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ExpenseAnalysisService
{
    private const STATES = [
        'pago' => ['REALIZADA', 'confirmado_em'],
        'pendente' => ['PENDENTE', 'created_at'],
        'aprovado' => ['APROVADA', 'aprovado_em'],
    ];

    private function expenses(int $ongId, string $status, string $field, array $period): Builder
    {
        return DB::table('financial_transactions as f')->where('f.ong_id', $ongId)
            ->where('f.tipo', 'DESPESA')->where('f.status', $status)
            ->where('f.'.$field, '>=', $period['de'].' 00:00:00')
            ->where('f.'.$field, '<', Carbon::parse($period['ate'])->addDay()->toDateString().' 00:00:00');
    }

    public function analyze(int $ongId, array $period): array
    {
        $money = new FinancialSummaryService;
        $rows = $this->expenses($ongId, 'REALIZADA', 'confirmado_em', $period)
            ->leftJoin('expense_categories as c', function ($join) use ($ongId): void {
                $join->on('c.id', '=', 'f.categoria_id')
                    ->where(fn ($query) => $query->whereNull('c.ong_id')->orWhere('c.ong_id', $ongId));
            })
            ->select('c.id', 'c.nome', 'c.ong_id', 'c.ativo')
            ->selectRaw('COUNT(*) AS quantidade, ROUND(SUM(f.valor) * 100, 0) AS cents')
            ->groupBy('c.id', 'c.nome', 'c.ong_id', 'c.ativo')->orderByDesc('cents')->orderBy('c.id')->get();
        $categories = [];
        $uncategorized = 0;
        foreach ($rows as $row) {
            $categories[] = [
                'categoriaId' => $row->id === null ? null : (int) $row->id,
                'nome' => $row->nome ?? 'Não categorizado',
                'global' => $row->id === null ? null : $row->ong_id === null,
                'ativo' => $row->id === null ? null : (bool) $row->ativo,
                'totalPago' => $money->money((int) $row->cents), 'quantidade' => (int) $row->quantidade,
            ];
            if ($row->id === null) {
                $uncategorized += (int) $row->cents;
            }
        }

        $months = [];
        $end = Carbon::parse($period['ate'])->startOfMonth();
        for ($month = Carbon::parse($period['de'])->startOfMonth(); $month->lte($end); $month->addMonth()) {
            $months[$month->format('Y-m')] = ['competencia' => $month->format('Y-m'), 'totalPago' => '0.00', 'totalPendente' => '0.00', 'totalAprovado' => '0.00', 'quantidade' => 0];
        }
        $totals = [];
        $count = 0;
        foreach (self::STATES as $key => [$status, $field]) {
            $column = 'f.'.$field;
            $expression = DB::connection()->getDriverName() === 'sqlite'
                ? "strftime('%Y-%m', {$column})" : "DATE_FORMAT({$column}, '%Y-%m')";
            $groups = $this->expenses($ongId, $status, $field, $period)
                ->selectRaw("{$expression} AS competencia, COUNT(*) AS quantidade, ROUND(SUM(f.valor) * 100, 0) AS cents")
                ->groupByRaw($expression)->get();
            $total = 0;
            $quantity = 0;
            $property = 'total'.ucfirst($key);
            foreach ($groups as $group) {
                $total += (int) $group->cents;
                $quantity += (int) $group->quantidade;
                $months[$group->competencia][$property] = $money->money((int) $group->cents);
                $months[$group->competencia]['quantidade'] += (int) $group->quantidade;
            }
            $totals[$property] = $money->money($total);
            $totals['quantidade'.ucfirst($key)] = $quantity;
            $count += $quantity;
        }

        return [
            'periodo' => $period,
            'criteriosTemporais' => ['pago' => 'confirmado_em', 'pendente' => 'created_at', 'aprovado' => 'aprovado_em'],
            'indicadores' => [...$totals, 'quantidadeDespesas' => $count, 'totalPagoSemCategoria' => $money->money($uncategorized), 'categoriaMaiorGasto' => $categories[0] ?? null],
            'categorias' => $categories, 'meses' => array_values($months),
        ];
    }
}
