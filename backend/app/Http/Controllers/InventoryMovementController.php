<?php

namespace App\Http\Controllers;

use App\Http\Requests\InventoryMovementRequest;
use App\Http\Requests\InventoryQueryRequest;
use App\Http\Resources\InventoryLotResource;
use App\Http\Resources\InventoryMovementResource;
use App\Http\Resources\InventoryProductResource;
use App\Models\FinancialTransaction;
use App\Models\InventoryLot;
use App\Models\InventoryMovement;
use App\Models\InventoryProduct;
use App\Services\InventoryMovementService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class InventoryMovementController extends Controller
{
    private const RELATIONS = ['produto', 'unidade', 'lote', 'responsavel', 'despesa:id,ong_id,descricao,status'];

    public function store(InventoryMovementRequest $request, InventoryMovementService $service): JsonResponse
    {
        [$movement,$created] = $service->execute($request->user(), $request->validated());

        return (new InventoryMovementResource($movement->load(self::RELATIONS)))->response()->setStatusCode($created ? 201 : 200);
    }

    public function index(InventoryQueryRequest $request): AnonymousResourceCollection
    {
        $q = InventoryMovement::where('ong_id', $request->user()->ong_id);
        if ($request->filled('despesaId')) {
            Gate::authorize('viewAny', FinancialTransaction::class);
            $expense = FinancialTransaction::where('ong_id', $request->user()->ong_id)->findOrFail($request->validated('despesaId'));
            $q->where('despesa_id', $expense->id);
        }
        foreach (['produtoId' => 'produto_id', 'loteId' => 'lote_id', 'responsavelId' => 'registrado_por', 'tipo' => 'tipo'] as $key => $column) {
            if ($request->filled($key)) {
                $q->where($column, $request->validated($key));
            }
        }
        if ($request->filled('de')) {
            $q->where('created_at', '>=', $request->validated('de').' 00:00:00');
        }
        if ($request->filled('ate')) {
            $q->where('created_at', '<', Carbon::parse($request->validated('ate'))->addDay()->toDateString());
        }

        return InventoryMovementResource::collection($q->with(self::RELATIONS)->orderByDesc('id')->paginate(15)->withQueryString());
    }

    public function show(Request $request, int $movimentacao): InventoryMovementResource
    {
        Gate::authorize('viewAny', InventoryProduct::class);

        return new InventoryMovementResource(InventoryMovement::where('ong_id', $request->user()->ong_id)->with(self::RELATIONS)->findOrFail($movimentacao));
    }

    public function lots(InventoryQueryRequest $request, int $produto): AnonymousResourceCollection
    {
        $product = InventoryProduct::where('ong_id', $request->user()->ong_id)->findOrFail($produto);

        return InventoryLotResource::collection(InventoryLot::where('produto_id', $product->id)->orderBy('id')->paginate(15));
    }

    public function alerts(InventoryQueryRequest $request): AnonymousResourceCollection
    {
        $type = $request->validated('tipo');
        if (in_array($type, ['BAIXO', 'ESGOTADO'], true)) {
            $q = InventoryProduct::where('ong_id', $request->user()->ong_id)->where('ativo', true);
            if ($type === 'ESGOTADO') {
                $q->where('quantidade_disponivel', 0);
            } else {
                $q->where('quantidade_disponivel', '>', 0)->whereColumn('quantidade_disponivel', '<=', 'quantidade_minima');
            }

            return InventoryProductResource::collection($q->with(['categoria', 'unidade', 'local'])->orderBy('id')->paginate(15)->withQueryString());
        }
        $q = InventoryLot::where('ong_id', $request->user()->ong_id)->where('quantidade_disponivel', '>', 0)->whereHas('produto', fn ($p) => $p->where('ativo', true));
        if ($type === 'VENCIDO') {
            $q->where('validade', '<', now()->toDateString());
        } else {
            $q->whereBetween('validade', [now()->toDateString(), now()->addDays($request->integer('dias', 30))->toDateString()]);
        }

        return InventoryLotResource::collection($q->with('produto')->orderBy('validade')->orderBy('id')->paginate(15)->withQueryString());
    }
}
