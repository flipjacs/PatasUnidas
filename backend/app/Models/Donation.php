<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Donation extends Model
{
    public const AMOUNT_PATTERN = '/^(?!0(?:\.0{1,2})?$)(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/';

    protected $fillable = ['ong_id', 'usuario_id', 'valor', 'status', 'mensagem', 'confirmado_por', 'confirmado_em', 'cancelado_em', 'cancelado_por'];

    protected function casts(): array
    {
        return ['valor' => 'decimal:2', 'confirmado_em' => 'datetime', 'cancelado_em' => 'datetime'];
    }

    public function ong(): BelongsTo
    {
        return $this->belongsTo(Ong::class, 'ong_id');
    }

    public function doador(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario_id');
    }

    public function confirmador(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'confirmado_por');
    }

    public function cancelador(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'cancelado_por');
    }

    public function lancamento(): HasOne
    {
        return $this->hasOne(FinancialTransaction::class, 'origem_id')->where('origem_tipo', 'DOACAO');
    }
}
