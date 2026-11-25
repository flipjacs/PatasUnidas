<?php

namespace App\Http\Resources;

use App\Services\InventoryMovementService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InventoryProductResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id, 'nome' => $this->nome, 'marca' => $this->marca, 'codigoInterno' => $this->codigo_interno,
            'descricao' => $this->descricao, 'observacoes' => $this->observacoes,
            'categoria' => new InventoryReferenceResource($this->whenLoaded('categoria')),
            'unidade' => new InventoryReferenceResource($this->whenLoaded('unidade')),
            'local' => $this->local ? new InventoryReferenceResource($this->local) : null,
            'quantidadeMinima' => $this->quantidade_minima, 'quantidadeDisponivel' => $this->quantidade_disponivel,
            'controlaValidade' => $this->controla_validade,
            'estadoEstoque' => $this->quantidade_disponivel === '0.000' ? 'ESGOTADO' : (InventoryMovementService::milli($this->quantidade_disponivel) <= InventoryMovementService::milli($this->quantidade_minima) ? 'BAIXO' : 'REGULAR'),
            'quantidadeSemLote' => $this->when(array_key_exists('lotes_sum_quantidade_disponivel', $this->resource->getAttributes()), fn () => InventoryMovementService::decimal(InventoryMovementService::milli($this->quantidade_disponivel) - InventoryMovementService::milli((string) ($this->lotes_sum_quantidade_disponivel ?? '0')))),
            'lotesDisponiveis' => $this->whenHas('lotes_disponiveis'),
            'possuiMovimentacoes' => $this->unidade_fixada_em !== null,
            'ativo' => $this->ativo, 'createdAt' => $this->created_at, 'updatedAt' => $this->updated_at,
        ];
    }
}
