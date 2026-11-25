<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InventoryExpenseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'descricao' => $this->descricao, 'valor' => $this->valor, 'status' => $this->status, 'categoriaDespesa' => $this->categoriaDespesa ? ['id' => $this->categoriaDespesa->id, 'nome' => $this->categoriaDespesa->nome, 'ativo' => $this->categoriaDespesa->ativo] : null, 'createdAt' => $this->created_at];
    }
}
