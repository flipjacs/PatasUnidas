<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UsuarioResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'nome' => $this->nome, 'email' => $this->email,
            'perfil' => strtoupper($this->perfil), 'ongId' => $this->ong_id,
            'ong' => $this->when($this->relationLoaded('ong'), fn (): ?array => $this->ong ? [
                'id' => $this->ong->id, 'nome' => $this->ong->nome, 'status' => $this->ong->status,
            ] : null)];
    }
}
