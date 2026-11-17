<?php

namespace App\Policies;

use App\Models\Animal;
use App\Models\Usuario;

class MedicalRecordPolicy
{
    public function viewAny(Usuario $user): bool
    {
        return $user->ativo && in_array($user->perfil, ['administrador', 'veterinario', 'voluntario'], true)
            && $user->ong_id !== null && $user->ong()->where('status', 'ATIVA')->exists();
    }

    public function create(Usuario $user, Animal $animal): bool
    {
        return $this->viewAny($user) && in_array($user->perfil, ['administrador', 'veterinario'], true)
            && $animal->ong_id === $user->ong_id;
    }

    public function correct(Usuario $user, Animal $animal): bool
    {
        return $this->create($user, $animal);
    }
}
