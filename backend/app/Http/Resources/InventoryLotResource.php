<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InventoryLotResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'produtoId' => $this->produto_id, 'codigo' => $this->codigo, 'validade' => $this->validade?->format('Y-m-d'), 'quantidadeDisponivel' => $this->quantidade_disponivel, 'vencido' => $this->validade !== null && $this->validade->format('Y-m-d') < now()->toDateString(), 'produto' => $this->whenLoaded('produto', fn () => ['id' => $this->produto->id, 'nome' => $this->produto->nome]), 'createdAt' => $this->created_at];
    }
}
