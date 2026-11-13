<?php

namespace App\Policies;

use App\Models\Usuario;

class UsuarioPolicy
{
    public function createInternal(Usuario $user): bool
    {
        return $this->manageEmployees($user);
    }

    public function manageEmployees(Usuario $user): bool
    {
        return $user->ativo && $user->perfil === 'administrador' && $user->ong_id !== null
            && $user->ong()->where('status', 'ATIVA')->exists();
    }
}
