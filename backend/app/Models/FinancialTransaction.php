<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinancialTransaction extends Model
{
    protected $fillable = [
        'ong_id', 'tipo', 'categoria', 'descricao', 'valor', 'status',
        'origem_tipo', 'origem_id', 'registrado_por', 'confirmado_por', 'confirmado_em',
        'aprovado_por', 'aprovado_em', 'cancelado_por', 'cancelado_em',
    ];

    protected function casts(): array
    {
        return ['valor' => 'decimal:2', 'confirmado_em' => 'datetime', 'aprovado_em' => 'datetime', 'cancelado_em' => 'datetime'];
    }

    public function ong(): BelongsTo
    {
        return $this->belongsTo(Ong::class, 'ong_id');
    }

    public function registrador(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'registrado_por');
    }

    public function aprovador(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'aprovado_por');
    }

    public function confirmador(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'confirmado_por');
    }

    public function cancelador(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'cancelado_por');
    }
}
