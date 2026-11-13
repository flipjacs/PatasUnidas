<?php

namespace App\Policies;

use App\Models\Animal;
use App\Models\Usuario;

class AnimalPolicy
{
    public function viewAny(Usuario $user): bool
    {
        return $user->ativo && in_array($user->perfil, ['administrador', 'voluntario'], true)
            && $user->ong_id !== null && $user->ong()->where('status', 'ATIVA')->exists();
    }

    public function create(Usuario $user): bool
    {
        return $this->viewAny($user);
    }

    public function view(Usuario $user, Animal $animal): bool
    {
        return $this->viewAny($user) && $animal->ong_id === $user->ong_id;
    }

    public function update(Usuario $user, Animal $animal): bool
    {
        return $this->view($user, $animal);
    }
}
