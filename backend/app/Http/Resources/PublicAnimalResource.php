<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicAnimalResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nome' => $this->nome,
            'especie' => $this->especie,
            'sexo' => $this->sexo,
            'porte' => $this->porte,
            'idadeAproximada' => $this->idade_aproximada,
            'descricao' => $this->descricao,
            'situacao' => $this->situacao,
            'fotoPrincipal' => $this->fotoPrincipal ? new AnimalPhotoResource($this->fotoPrincipal) : null,
            'fotos' => $this->whenLoaded('fotos', fn () => AnimalPhotoResource::collection($this->fotos)),
            'ong' => [
                'id' => $this->ong->id,
                'nome' => $this->ong->nome,
                'cidade' => $this->ong->cidade,
                'estado' => $this->ong->estado,
            ],
        ];
    }
}
