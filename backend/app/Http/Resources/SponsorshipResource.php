<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class SponsorshipResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'animal' => $this->whenLoaded('animal', fn () => ['id' => $this->animal->id, 'nome' => $this->animal->nome]),
            'ong' => $this->whenLoaded('ong', fn () => ['id' => $this->ong->id, 'nome' => $this->ong->nome]),
            'modalidade' => $this->modalidade,
            'valor' => $this->valor,
            'status' => $this->status,
            'dataInicio' => $this->data_inicio->toDateString(),
            'dataEncerramento' => $this->data_encerramento?->toDateString(),
            'motivoEncerramento' => $this->motivo_encerramento,
            'justificativaEncerramento' => $this->justificativa_encerramento,
            'proximoVencimento' => $this->proximo_vencimento ? Carbon::parse($this->proximo_vencimento)->toDateString() : null,
            'primeiraParcela' => $this->whenLoaded('primeiraParcela', fn () => new SponsorshipInstallmentResource($this->primeiraParcela)),
            'createdAt' => $this->created_at,
            'updatedAt' => $this->updated_at,
        ];
    }
}
