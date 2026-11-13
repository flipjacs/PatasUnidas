<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinancialTransaction extends Model
{
    protected $fillable = [
        'ong_id', 'tipo', 'categoria', 'descricao', 'valor', 'status',
        'origem_tipo', 'origem_id', 'registrado_por', 'confirmado_por', 'confirmado_em',
    ];

    protected function casts(): array
    {
        return ['valor' => 'decimal:2', 'confirmado_em' => 'datetime'];
    }

    public function ong(): BelongsTo
    {
        return $this->belongsTo(Ong::class, 'ong_id');
    }
}
