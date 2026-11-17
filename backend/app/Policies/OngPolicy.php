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

    public function viewDashboard(Usuario $user): bool
    {
        return $user->ativo && in_array($user->perfil, ['administrador', 'voluntario', 'veterinario'], true)
            && $user->ong_id !== null && $user->ong()->where('status', 'ATIVA')->exists();
    }

    public function viewFinancialReport(Usuario $user): bool
    {
        return $user->perfil === 'administrador' && $this->viewDashboard($user);
    }
}
