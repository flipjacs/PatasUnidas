<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryProduct extends Model
{
    protected $fillable = ['nome', 'marca', 'codigo_interno', 'identidade', 'descricao', 'observacoes', 'categoria_id', 'unidade_id', 'local_id', 'quantidade_minima', 'controla_validade'];

    protected function casts(): array
    {
        return ['controla_validade' => 'boolean', 'quantidade_minima' => 'decimal:3', 'quantidade_disponivel' => 'decimal:3', 'ativo' => 'boolean', 'unidade_fixada_em' => 'datetime'];
    }

    public function lotes(): HasMany
    {
        return $this->hasMany(InventoryLot::class, 'produto_id');
    }

    public function movimentacoes(): HasMany
    {
        return $this->hasMany(InventoryMovement::class, 'produto_id');
    }

    public function ong(): BelongsTo
    {
        return $this->belongsTo(Ong::class, 'ong_id');
    }

    public function categoria(): BelongsTo
    {
        return $this->belongsTo(InventoryCategory::class, 'categoria_id');
    }

    public function unidade(): BelongsTo
    {
        return $this->belongsTo(InventoryUnit::class, 'unidade_id');
    }

    public function local(): BelongsTo
    {
        return $this->belongsTo(StorageLocation::class, 'local_id');
    }
}
