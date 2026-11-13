<?php

namespace App\Policies;

use App\Models\Ong;
use App\Models\Usuario;

class OngPolicy
{
    public function viewAny(Usuario $user): bool
    {
        return $user->ativo && $user->perfil === 'criador_plataforma' && $user->ong_id === null;
    }

    public function view(Usuario $user, Ong $ong): bool
    {
        return $this->viewAny($user);
    }

    public function create(Usuario $user): bool
    {
        return $this->viewAny($user);
    }

    public function update(Usuario $user, Ong $ong): bool
    {
        return $this->viewAny($user);
    }
}
