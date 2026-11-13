<?php

namespace App\Policies;

use App\Models\AdoptionRequest;
use App\Models\Usuario;

class AdoptionRequestPolicy
{
    public function create(Usuario $user): bool
    {
        return $user->ativo && $user->perfil === 'usuario';
    }

    public function viewOwn(Usuario $user): bool
    {
        return $this->create($user);
    }

    public function cancel(Usuario $user, AdoptionRequest $solicitacao): bool
    {
        return $this->viewOwn($user) && $solicitacao->usuario_id === $user->id;
    }

    public function viewInternal(Usuario $user): bool
    {
        return $user->ativo && in_array($user->perfil, ['administrador', 'voluntario'], true)
            && $user->ong_id !== null && $user->ong()->where('status', 'ATIVA')->exists();
    }

    public function reject(Usuario $user, AdoptionRequest $solicitacao): bool
    {
        return $this->viewInternal($user) && $solicitacao->ong_id === $user->ong_id;
    }

    public function approve(Usuario $user, AdoptionRequest $solicitacao): bool
    {
        return $this->reject($user, $solicitacao);
    }

    public function cancelApproval(Usuario $user, AdoptionRequest $solicitacao): bool
    {
        return $this->reject($user, $solicitacao);
    }

    public function confirmDelivery(Usuario $user, AdoptionRequest $solicitacao): bool
    {
        return $this->reject($user, $solicitacao);
    }
}
