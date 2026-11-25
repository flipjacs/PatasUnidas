<?php

namespace App\Http\Controllers;

use App\Http\Requests\InventoryReportRequest;
use App\Http\Resources\InventoryCriticalProductResource;
use App\Models\InventoryProduct;
use App\Services\InventoryReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class InventoryReportController extends Controller
{
    public function summary(InventoryReportRequest $request, InventoryReportService $service): JsonResponse
    {
        return response()->json(DB::transaction(fn () => $service->analyze($request->user()->ong_id, $request->validated())));
    }

    public function critical(InventoryReportRequest $request): AnonymousResourceCollection
    {
        $query = InventoryProduct::where('ong_id', $request->user()->ong_id)->where('ativo', true)
            ->whereColumn('quantidade_disponivel', '<=', 'quantidade_minima');
        foreach (['categoriaId' => 'categoria_id', 'produtoId' => 'id', 'unidadeId' => 'unidade_id'] as $key => $column) {
            if ($request->filled($key)) {
                $query->where($column, $request->validated($key));
            }
        }

        return InventoryCriticalProductResource::collection($query->with(['categoria', 'unidade'])
            ->orderByRaw('CASE WHEN quantidade_disponivel = 0 THEN 0 ELSE 1 END')->orderBy('id')->paginate(15)->withQueryString());
    }
}
