<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MedicalRecordCorrectionResource extends JsonResource
{
    public static $wrap = null;

    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'createdAt' => $this->created_at,
            'justificativa' => $this->justificativa,
            'corrigidoPor' => ['id' => $this->responsavel->id, 'nome' => $this->responsavel->nome],
            'dadosAnteriores' => $this->dados_anteriores,
            'dadosNovos' => $this->dados_novos,
        ];
    }
}
