<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FinancialTransactionResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'tipo' => $this->tipo,
            'categoria' => $this->categoria,
            'descricao' => $this->descricao,
            'valor' => $this->valor,
            'status' => $this->status,
            'origem' => ['tipo' => $this->origem_tipo ?? 'MANUAL', 'id' => $this->origem_id],
            'registradoPor' => $this->registrador ? ['id' => $this->registrador->id, 'nome' => $this->registrador->nome] : null,
            'aprovadoPor' => $this->aprovador ? ['id' => $this->aprovador->id, 'nome' => $this->aprovador->nome] : null,
            'confirmadoPor' => $this->confirmador ? ['id' => $this->confirmador->id, 'nome' => $this->confirmador->nome] : null,
            'canceladoPor' => $this->cancelador ? ['id' => $this->cancelador->id, 'nome' => $this->cancelador->nome] : null,
            'aprovadoEm' => $this->aprovado_em,
            'confirmadoEm' => $this->confirmado_em,
            'canceladoEm' => $this->cancelado_em,
            'createdAt' => $this->created_at,
        ];
    }
}
