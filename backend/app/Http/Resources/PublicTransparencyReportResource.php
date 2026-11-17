<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicTransparencyReportResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        $snapshot = $this->dados_consolidados;

        return [
            'id' => $this->id,
            'ong' => $this->whenLoaded('ong', fn () => [
                'id' => $this->ong->id,
                'nome' => $this->ong->nome,
            ]),
            'titulo' => $this->titulo,
            'descricao' => $this->descricao,
            'periodoInicio' => $this->periodo_inicio->toDateString(),
            'periodoFim' => $this->periodo_fim->toDateString(),
            'publicadoEm' => $this->publicado_em,
            'dados' => [
                'receitasRealizadas' => $snapshot['receitasRealizadas'],
                'despesasRealizadas' => $snapshot['despesasRealizadas'],
                'resultadoLiquido' => $snapshot['resultadoLiquido'],
                'receitasPorCategoria' => $snapshot['receitasPorCategoria'],
                'despesasPorCategoria' => $snapshot['despesasPorCategoria'],
                'quantidadeMovimentacoes' => $snapshot['quantidadeMovimentacoes'],
            ],
        ];
    }
}
