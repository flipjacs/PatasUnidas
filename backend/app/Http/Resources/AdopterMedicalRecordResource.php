<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdopterMedicalRecordResource extends JsonResource
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
            'animal' => ['id' => $this->animal->id, 'nome' => $this->animal->nome],
            'tipo' => $this->tipo,
            'titulo' => $this->titulo,
            'descricao' => $this->descricao,
            'dataProcedimento' => $this->data_procedimento->format('Y-m-d'),
            'profissionalResponsavel' => $this->profissional_responsavel,
            'medicamentos' => $this->medicamentos,
            'observacoes' => $this->observacoes,
        ];
    }
}
