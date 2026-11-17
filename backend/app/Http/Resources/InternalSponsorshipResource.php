<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

class InternalSponsorshipResource extends SponsorshipResource
{
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'padrinho' => $this->whenLoaded('usuario', fn () => [
                'id' => $this->usuario->id,
                'nome' => $this->usuario->nome,
                'email' => $this->usuario->email,
            ]),
        ];
    }
}
