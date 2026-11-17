<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SponsorshipInstallment extends Model
{
    protected $fillable = ['sponsorship_id', 'numero', 'valor', 'vencimento', 'status', 'confirmado_em', 'confirmado_por'];

    protected function casts(): array
    {
        return ['valor' => 'decimal:2', 'vencimento' => 'date', 'confirmado_em' => 'datetime'];
    }

    public function sponsorship(): BelongsTo
    {
        return $this->belongsTo(Sponsorship::class, 'sponsorship_id');
    }

    public function confirmador(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'confirmado_por');
    }
}
