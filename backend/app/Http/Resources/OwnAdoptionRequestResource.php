<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OwnAdoptionRequestResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'animal' => ['id' => $this->animal->id, 'nome' => $this->animal->nome],
            'ong' => ['id' => $this->ong->id, 'nome' => $this->ong->nome],
            'status' => $this->status,
            'mensagem' => $this->mensagem,
            'justificativaRejeicao' => $this->justificativa_rejeicao,
            'justificativaCancelamento' => $this->justificativa_cancelamento,
            'analisadoEm' => $this->analisado_em,
            'canceladoEm' => $this->cancelado_em,
            'adocao' => $this->whenLoaded('adocao', fn () => $this->adocao ? [
                'id' => $this->adocao->id,
                'dataEntrega' => $this->adocao->data_entrega,
            ] : null),
            'createdAt' => $this->created_at,
            'updatedAt' => $this->updated_at,
        ];
    }
}
