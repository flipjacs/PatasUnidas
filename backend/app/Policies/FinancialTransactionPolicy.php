<?php

namespace App\Policies;

use App\Models\FinancialTransaction;
use App\Models\Usuario;

class FinancialTransactionPolicy
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

    public function manage(Usuario $user, FinancialTransaction $transaction): bool
    {
        return $this->viewAny($user) && $user->perfil === 'administrador'
            && $transaction->ong_id === $user->ong_id;
    }
}
