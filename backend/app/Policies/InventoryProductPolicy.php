<?php

namespace App\Policies;

use App\Models\InventoryProduct;
use App\Models\Usuario;

class InventoryProductPolicy
{
    public function viewAny(Usuario $user): bool
    {
        return $user->ativo && $user->ong_id !== null
            && in_array($user->perfil, ['administrador', 'voluntario', 'veterinario'], true)
            && $user->ong()->where('status', 'ATIVA')->exists();
    }

    public function adjust(Usuario $user): bool
    {
        return $this->manageReferences($user);
    }

    public function create(Usuario $user): bool
    {
        return $this->viewAny($user) && in_array($user->perfil, ['administrador', 'voluntario'], true);
    }

    public function update(Usuario $user, InventoryProduct $product): bool
    {
        return $this->create($user) && $product->ong_id === $user->ong_id;
    }

    public function manageReferences(Usuario $user): bool
    {
        return $this->viewAny($user) && $user->perfil === 'administrador';
    }

    public function changeStatus(Usuario $user, InventoryProduct $product): bool
    {
        return $this->manageReferences($user) && $product->ong_id === $user->ong_id;
    }
}
