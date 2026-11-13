<?php

namespace App\Policies;

use App\Models\Donation;
use App\Models\Usuario;

class DonationPolicy
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

    public function confirm(Usuario $user, Donation $donation): bool
    {
        return $this->viewInternal($user) && $user->perfil === 'administrador'
            && $donation->ong_id === $user->ong_id;
    }

    public function cancel(Usuario $user, Donation $donation): bool
    {
        return $this->confirm($user, $donation);
    }
}
