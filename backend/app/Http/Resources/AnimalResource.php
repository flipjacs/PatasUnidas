<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AnimalResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'ongId' => $this->ong_id,
            'nome' => $this->nome,
            'especie' => $this->especie,
            'sexo' => $this->sexo,
            'porte' => $this->porte,
            'idadeAproximada' => $this->idade_aproximada,
            'descricao' => $this->descricao,
            'situacao' => $this->situacao,
            'publicado' => $this->publicado,
            'createdAt' => $this->created_at,
            'updatedAt' => $this->updated_at,
        ];
    }
}
