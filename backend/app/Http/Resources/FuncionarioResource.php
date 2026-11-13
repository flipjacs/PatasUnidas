<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

class FuncionarioResource extends UsuarioResource
{
    public function toArray(Request $request): array
    {
        return [...parent::toArray($request), 'ativo' => $this->ativo];
    }
}
