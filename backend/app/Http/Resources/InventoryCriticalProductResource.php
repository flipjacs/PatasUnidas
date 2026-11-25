<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InventoryCriticalProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id, 'nome' => $this->nome,
            'categoria' => ['id' => $this->categoria->id, 'nome' => $this->categoria->nome, 'ativo' => $this->categoria->ativo],
            'unidade' => ['id' => $this->unidade->id, 'codigo' => $this->unidade->codigo, 'sigla' => $this->unidade->sigla],
            'quantidadeDisponivel' => $this->quantidade_disponivel, 'quantidadeMinima' => $this->quantidade_minima,
            'estadoEstoque' => $this->quantidade_disponivel === '0.000' ? 'ESGOTADO' : 'BAIXO',
        ];
    }
}
