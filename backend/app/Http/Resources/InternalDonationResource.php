<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

class InternalDonationResource extends OwnDonationResource
{
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'doador' => $this->doador ? [
                'id' => $this->doador->id,
                'nome' => $this->doador->nome,
            ] : null,
            'confirmadoPor' => $this->confirmador ? [
                'id' => $this->confirmador->id,
                'nome' => $this->confirmador->nome,
            ] : null,
            'canceladoPor' => $this->cancelador ? [
                'id' => $this->cancelador->id,
                'nome' => $this->cancelador->nome,
            ] : null,
        ];
    }
}
