<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryMovement extends Model
{
    public $timestamps = false;

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['quantidade' => 'decimal:3', 'saldo_anterior' => 'decimal:3', 'saldo_posterior' => 'decimal:3', 'created_at' => 'datetime'];
    }

    public function despesa(): BelongsTo
    {
        return $this->belongsTo(FinancialTransaction::class, 'despesa_id');
    }

    public function produto(): BelongsTo
    {
        return $this->belongsTo(InventoryProduct::class, 'produto_id');
    }

    public function unidade(): BelongsTo
    {
        return $this->belongsTo(InventoryUnit::class, 'unidade_id');
    }

    public function lote(): BelongsTo
    {
        return $this->belongsTo(InventoryLot::class, 'lote_id');
    }

    public function responsavel(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'registrado_por');
    }
}
