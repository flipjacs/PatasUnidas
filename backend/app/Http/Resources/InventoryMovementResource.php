<?php

namespace App\Http\Resources;

use App\Models\FinancialTransaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

class InventoryMovementResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'despesa' => $this->whenLoaded('despesa', function () use ($request): ?array {
            if (! $this->despesa) {
                return null;
            }
            $key = 'inventory.expense_details';
            if (! $request->attributes->has($key)) {
                $request->attributes->set($key, Gate::allows('viewAny', FinancialTransaction::class));
            }

            return $request->attributes->get($key) ? ['id' => $this->despesa->id, 'descricao' => $this->despesa->descricao, 'status' => $this->despesa->status] : ['id' => $this->despesa->id];
        }), 'produto' => ['id' => $this->produto->id, 'nome' => $this->produto->nome], 'tipo' => $this->tipo, 'quantidade' => $this->quantidade, 'unidade' => new InventoryReferenceResource($this->unidade), 'saldoAnterior' => $this->saldo_anterior, 'saldoPosterior' => $this->saldo_posterior, 'motivo' => $this->motivo, 'observacoes' => $this->observacoes, 'responsavel' => ['id' => $this->responsavel->id, 'nome' => $this->responsavel->nome], 'lote' => $this->lote ? new InventoryLotResource($this->lote) : null, 'chaveOperacao' => $this->chave_operacao, 'createdAt' => $this->created_at];
    }
}
