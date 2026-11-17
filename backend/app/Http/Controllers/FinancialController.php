<?php

namespace App\Http\Controllers;

use App\Http\Requests\FinancialMovementRequest;
use App\Http\Resources\FinancialTransactionResource;
use App\Models\Donation;
use App\Models\FinancialTransaction;
use App\Services\FinancialSummaryService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class FinancialController extends Controller
{
    private function own(Request $request): Builder
    {
        Gate::authorize('viewAny', FinancialTransaction::class);

        return FinancialTransaction::query()->where('ong_id', $request->user()->ong_id);
    }

    private function details(Builder $query): Builder
    {
        return $query->with(['registrador:id,nome', 'aprovador:id,nome', 'confirmador:id,nome', 'cancelador:id,nome']);
    }

    private function period(Request $request): array
    {
        return $request->validate([
            'de' => ['sometimes', 'date_format:Y-m-d'],
            'ate' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:de'],
        ]);
    }

    private function dateRange(Builder $query, array $period, string $field): Builder
    {
        if (isset($period['de'])) {
            $query->where($field, '>=', $period['de'].' 00:00:00');
        }
        if (isset($period['ate'])) {
            $query->where($field, '<', Carbon::parse($period['ate'])->addDay()->toDateString().' 00:00:00');
        }

        return $query;
    }

    public function store(FinancialMovementRequest $request): JsonResponse
    {
        Gate::authorize('create', FinancialTransaction::class);
        $data = $request->validated();
        $transaction = FinancialTransaction::create([
            ...$data,
            'ong_id' => $request->user()->ong_id,
            'registrado_por' => $request->user()->id,
            'status' => 'PENDENTE',
            'origem_tipo' => null,
            'origem_id' => null,
        ]);

        return (new FinancialTransactionResource($this->details(FinancialTransaction::query())->findOrFail($transaction->id)))
            ->response()->setStatusCode(201);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'tipo' => ['sometimes', Rule::in(['RECEITA', 'DESPESA'])],
            'status' => ['sometimes', Rule::in(['PENDENTE', 'APROVADA', 'REALIZADA', 'CANCELADA'])],
            'categoria' => ['sometimes', Rule::in(['DOACAO', 'APADRINHAMENTO', 'EVENTO', 'OUTRA_RECEITA', 'ALIMENTACAO', 'MEDICAMENTOS', 'VETERINARIO', 'TRANSPORTE', 'MANUTENCAO', 'OUTRA_DESPESA'])],
            'de' => ['sometimes', 'date_format:Y-m-d'],
            'ate' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:de'],
        ]);
        $query = $this->details($this->dateRange($this->own($request), $filters, 'created_at'));
        foreach (['tipo', 'status', 'categoria'] as $field) {
            if (isset($filters[$field])) {
                $query->where($field, $filters[$field]);
            }
        }

        return FinancialTransactionResource::collection($query->orderByDesc('created_at')->orderByDesc('id')->paginate(15));
    }

    public function show(Request $request, int $movimentacao): FinancialTransactionResource
    {
        return new FinancialTransactionResource($this->details($this->own($request))->findOrFail($movimentacao));
    }

    private function change(Request $request, int $id, string $action): FinancialTransactionResource
    {
        $transaction = DB::transaction(function () use ($request, $id, $action): FinancialTransaction {
            $record = $this->own($request)->lockForUpdate()->findOrFail($id);
            Gate::authorize('manage', $record);
            if ($request->all() !== []) {
                throw ValidationException::withMessages(['payload' => 'Campos não permitidos.']);
            }
            if ($record->origem_tipo !== null || $record->origem_id !== null
                || ! preg_match(Donation::AMOUNT_PATTERN, $record->valor)) {
                throw new HttpException(409, 'Movimentação indisponível para esta operação.');
            }
            $now = now();
            $values = match ($action) {
                'approve' => $record->tipo === 'DESPESA' && $record->status === 'PENDENTE'
                    ? ['status' => 'APROVADA', 'aprovado_por' => $request->user()->id, 'aprovado_em' => $now] : null,
                'payment' => $record->tipo === 'DESPESA' && $record->status === 'APROVADA'
                    ? ['status' => 'REALIZADA', 'confirmado_por' => $request->user()->id, 'confirmado_em' => $now] : null,
                'receipt' => $record->tipo === 'RECEITA' && $record->status === 'PENDENTE'
                    ? ['status' => 'REALIZADA', 'confirmado_por' => $request->user()->id, 'confirmado_em' => $now] : null,
                'cancel' => in_array($record->status, ['PENDENTE', 'APROVADA'], true)
                    ? ['status' => 'CANCELADA', 'cancelado_por' => $request->user()->id, 'cancelado_em' => $now] : null,
            };
            if ($values === null) {
                throw new HttpException(409, 'Transição financeira inválida.');
            }
            $record->update($values);

            return $record;
        });

        return new FinancialTransactionResource($transaction->load(['registrador:id,nome', 'aprovador:id,nome', 'confirmador:id,nome', 'cancelador:id,nome']));
    }

    public function approve(Request $request, int $movimentacao): FinancialTransactionResource
    {
        return $this->change($request, $movimentacao, 'approve');
    }

    public function confirmPayment(Request $request, int $movimentacao): FinancialTransactionResource
    {
        return $this->change($request, $movimentacao, 'payment');
    }

    public function confirmReceipt(Request $request, int $movimentacao): FinancialTransactionResource
    {
        return $this->change($request, $movimentacao, 'receipt');
    }

    public function cancel(Request $request, int $movimentacao): FinancialTransactionResource
    {
        return $this->change($request, $movimentacao, 'cancel');
    }

    public function summary(Request $request, FinancialSummaryService $finance): JsonResponse
    {
        $period = $this->period($request);
        $this->own($request);

        return response()->json($finance->summary($request->user()->ong_id, $period));
    }
}
