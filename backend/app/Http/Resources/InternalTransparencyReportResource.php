<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

class InternalTransparencyReportResource extends PublicTransparencyReportResource
{
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'status' => $this->status,
            'publicadoPor' => $this->publicado_por,
            'despublicadoEm' => $this->despublicado_em,
            'createdAt' => $this->created_at,
            'updatedAt' => $this->updated_at,
        ];
    }
}
