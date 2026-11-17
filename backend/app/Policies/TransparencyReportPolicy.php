<?php

namespace App\Policies;

use App\Models\TransparencyReport;
use App\Models\Usuario;

class TransparencyReportPolicy
{
    public function viewAny(Usuario $user): bool
    {
        return $user->ativo && in_array($user->perfil, ['administrador', 'voluntario'], true)
            && $user->ong_id !== null && $user->ong()->where('status', 'ATIVA')->exists();
    }

    public function view(Usuario $user, TransparencyReport $report): bool
    {
        return $this->viewAny($user) && $report->ong_id === $user->ong_id;
    }

    public function create(Usuario $user): bool
    {
        return $user->perfil === 'administrador' && $this->viewAny($user);
    }

    public function update(Usuario $user, TransparencyReport $report): bool
    {
        return $user->perfil === 'administrador' && $this->view($user, $report);
    }
}
