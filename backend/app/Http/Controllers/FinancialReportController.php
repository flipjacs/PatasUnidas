<?php

namespace App\Http\Controllers;

use App\Http\Requests\ExpenseAnalysisRequest;
use App\Http\Requests\ReportPeriodRequest;
use App\Models\Ong;
use App\Services\ExpenseAnalysisService;
use App\Services\FinancialSummaryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class FinancialReportController extends Controller
{
    public function expenseAnalysis(ExpenseAnalysisRequest $request, ExpenseAnalysisService $analysis): JsonResponse
    {
        return response()->json(DB::transaction(fn (): array => $analysis->analyze($request->user()->ong_id, $request->validated())));
    }

    public function index(ReportPeriodRequest $request, FinancialSummaryService $finance): JsonResponse
    {
        Gate::authorize('viewFinancialReport', Ong::class);
        $period = $request->validated();
        $ongId = $request->user()->ong_id;

        return response()->json([
            'periodo' => ['de' => $period['de'] ?? null, 'ate' => $period['ate'] ?? null],
            'semanticaPeriodo' => 'Valores realizados usam a data de confirmação; pendentes usam o cadastro; despesas aprovadas usam a aprovação; quantidade de movimentações usa o cadastro.',
            ...$finance->summary($ongId, $period),
            'quantidadeMovimentacoes' => $finance->movementCount($ongId, $period),
            ...$finance->categories($ongId, $period),
        ]);
    }
}
