<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

class InternalAdoptionRequestResource extends OwnAdoptionRequestResource
{
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'solicitante' => [
                'id' => $this->solicitante->id,
                'nome' => $this->solicitante->nome,
                'email' => $this->solicitante->email,
            ],
            'analisadoPor' => $this->analisador ? [
                'id' => $this->analisador->id,
                'nome' => $this->analisador->nome,
            ] : null,
            'canceladoPor' => $this->cancelador ? [
                'id' => $this->cancelador->id,
                'nome' => $this->cancelador->nome,
            ] : null,
        ];
    }
}
