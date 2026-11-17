<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SponsorshipInstallmentResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'numero' => $this->numero,
            'valor' => $this->valor,
            'vencimento' => $this->vencimento->toDateString(),
            'status' => $this->status,
            'vencida' => $this->status === 'PENDENTE' && $this->vencimento->isBefore(today()),
            'confirmadoEm' => $this->confirmado_em,
            'confirmadoPor' => $this->whenLoaded('confirmador', fn () => $this->confirmador ? [
                'id' => $this->confirmador->id,
                'nome' => $this->confirmador->nome,
            ] : null),
        ];
    }
}
