<?php

namespace App\Policies;

use App\Models\Usuario;

class SponsorshipPolicy
{
    public function create(Usuario $user): bool
    {
        return $user->ativo && $user->perfil === 'usuario';
    }

    public function viewOwn(Usuario $user): bool
    {
        return $this->create($user);
    }

    public function viewInternal(Usuario $user): bool
    {
        return $user->ativo && in_array($user->perfil, ['administrador', 'voluntario'], true)
            && $user->ong_id !== null && $user->ong()->where('status', 'ATIVA')->exists();
    }

    public function closeInternal(Usuario $user): bool
    {
        return $user->perfil === 'administrador' && $this->viewInternal($user);
    }

    public function confirmInstallment(Usuario $user): bool
    {
        return $this->closeInternal($user);
    }
}
