<?php

namespace App\Http\Resources;

use App\Models\InventoryCategory;
use App\Models\InventoryUnit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InventoryReferenceResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        $data = ['id' => $this->id, 'nome' => $this->nome];
        if ($this->resource instanceof InventoryUnit) {
            return [...$data, 'codigo' => $this->codigo, 'sigla' => $this->sigla, 'fracionavel' => $this->fracionavel];
        }
        $data['ativo'] = $this->ativo;
        if ($this->resource instanceof InventoryCategory) {
            return [...$data, 'codigo' => $this->codigo, 'global' => $this->ong_id === null,
                'gerenciavel' => $this->ong_id !== null && $request->user()->perfil === 'administrador'];
        }

        return [...$data, 'descricao' => $this->descricao];
    }
}
