<?php

namespace App\Http\Controllers;

use App\Http\Requests\TransparencyReportListRequest;
use App\Http\Requests\TransparencyReportRequest;
use App\Http\Resources\InternalTransparencyReportResource;
use App\Models\TransparencyReport;
use App\Services\FinancialSummaryService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class TransparencyReportController extends Controller
{
    private function internal(Request $request): Builder
    {
        Gate::authorize('viewAny', TransparencyReport::class);

        return TransparencyReport::query()->where('ong_id', $request->user()->ong_id);
    }

    private function response(TransparencyReport $report): InternalTransparencyReportResource
    {
        return new InternalTransparencyReportResource($report->load('ong:id,nome'));
    }

    public function store(TransparencyReportRequest $request, FinancialSummaryService $finance): JsonResponse
    {
        Gate::authorize('create', TransparencyReport::class);
        $data = $request->validated();
        $report = DB::transaction(fn (): TransparencyReport => TransparencyReport::create([
            'ong_id' => $request->user()->ong_id,
            'periodo_inicio' => $data['periodoInicio'],
            'periodo_fim' => $data['periodoFim'],
            'titulo' => $data['titulo'],
            'descricao' => $data['descricao'] ?? null,
            'status' => 'RASCUNHO',
            'dados_consolidados' => $finance->publicSnapshot($request->user()->ong_id, $data['periodoInicio'], $data['periodoFim']),
        ]));

        return $this->response($report)->response()->setStatusCode(201);
    }

    public function index(TransparencyReportListRequest $request): AnonymousResourceCollection
    {
        $filters = $request->validated();
        $query = $this->internal($request)->with('ong:id,nome');
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (isset($filters['de'])) {
            $query->where('periodo_fim', '>=', $filters['de']);
        }
        if (isset($filters['ate'])) {
            $query->where('periodo_inicio', '<', Carbon::parse($filters['ate'])->addDay()->toDateString());
        }

        return InternalTransparencyReportResource::collection($query->orderByDesc('created_at')->orderByDesc('id')->paginate(15));
    }

    public function show(Request $request, int $demonstrativo): InternalTransparencyReportResource
    {
        return $this->response($this->internal($request)->findOrFail($demonstrativo));
    }

    public function update(TransparencyReportRequest $request, int $demonstrativo, FinancialSummaryService $finance): InternalTransparencyReportResource
    {
        Gate::authorize('create', TransparencyReport::class);
        $data = $request->validated();
        $report = DB::transaction(function () use ($request, $demonstrativo, $data, $finance): TransparencyReport {
            $report = $this->internal($request)->lockForUpdate()->findOrFail($demonstrativo);
            Gate::authorize('update', $report);
            if ($report->status !== 'RASCUNHO') {
                throw new HttpException(409, 'Demonstrativo publicado não pode ser editado.');
            }
            $start = $data['periodoInicio'] ?? $report->periodo_inicio->toDateString();
            $end = $data['periodoFim'] ?? $report->periodo_fim->toDateString();
            if ($start > $end) {
                throw ValidationException::withMessages(['periodoFim' => 'O fim deve ser igual ou posterior ao início.']);
            }
            $changes = [];
            if (array_key_exists('titulo', $data)) {
                $changes['titulo'] = $data['titulo'];
            }
            if (array_key_exists('descricao', $data)) {
                $changes['descricao'] = $data['descricao'];
            }
            if (isset($data['periodoInicio']) || isset($data['periodoFim'])) {
                $changes['periodo_inicio'] = $start;
                $changes['periodo_fim'] = $end;
                if ($start !== $report->periodo_inicio->toDateString() || $end !== $report->periodo_fim->toDateString()) {
                    $changes['dados_consolidados'] = $finance->publicSnapshot($report->ong_id, $start, $end);
                }
            }
            if ($changes !== []) {
                $report->update($changes);
            }

            return $report;
        });

        return $this->response($report);
    }

    public function publish(Request $request, int $demonstrativo, FinancialSummaryService $finance): InternalTransparencyReportResource
    {
        Gate::authorize('create', TransparencyReport::class);
        if ($request->all() !== []) {
            throw ValidationException::withMessages(['payload' => 'Campos não permitidos.']);
        }
        $report = DB::transaction(function () use ($request, $demonstrativo, $finance): TransparencyReport {
            $report = $this->internal($request)->lockForUpdate()->findOrFail($demonstrativo);
            Gate::authorize('update', $report);
            if ($report->status !== 'RASCUNHO') {
                throw new HttpException(409, 'Demonstrativo já publicado.');
            }
            $report->update([
                'dados_consolidados' => $finance->publicSnapshot(
                    $report->ong_id, $report->periodo_inicio->toDateString(), $report->periodo_fim->toDateString()
                ),
                'status' => 'PUBLICADO',
                'publicado_por' => $request->user()->id,
                'publicado_em' => now(),
            ]);

            return $report;
        });

        return $this->response($report);
    }

    public function unpublish(Request $request, int $demonstrativo): InternalTransparencyReportResource
    {
        Gate::authorize('create', TransparencyReport::class);
        if ($request->all() !== []) {
            throw ValidationException::withMessages(['payload' => 'Campos não permitidos.']);
        }
        $report = DB::transaction(function () use ($request, $demonstrativo): TransparencyReport {
            $report = $this->internal($request)->lockForUpdate()->findOrFail($demonstrativo);
            Gate::authorize('update', $report);
            if ($report->status !== 'PUBLICADO') {
                throw new HttpException(409, 'Demonstrativo não está publicado.');
            }
            $report->update(['status' => 'RASCUNHO', 'despublicado_em' => now()]);

            return $report;
        });

        return $this->response($report);
    }
}
