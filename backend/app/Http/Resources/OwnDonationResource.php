<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OwnDonationResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'ong' => ['id' => $this->ong->id, 'nome' => $this->ong->nome],
            'valor' => $this->valor,
            'status' => $this->status,
            'mensagem' => $this->mensagem,
            'confirmadoEm' => $this->confirmado_em,
            'canceladoEm' => $this->cancelado_em,
            'createdAt' => $this->created_at,
            'updatedAt' => $this->updated_at,
        ];
    }
}
