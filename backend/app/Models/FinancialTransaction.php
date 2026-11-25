<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FinancialTransaction extends Model
{
    protected $fillable = [
        'ong_id', 'tipo', 'categoria', 'categoria_id', 'descricao', 'valor', 'status',
        'origem_tipo', 'origem_id', 'registrado_por', 'confirmado_por', 'confirmado_em',
        'aprovado_por', 'aprovado_em', 'cancelado_por', 'cancelado_em',
    ];

    protected function casts(): array
    {
        return ['valor' => 'decimal:2', 'confirmado_em' => 'datetime', 'aprovado_em' => 'datetime', 'cancelado_em' => 'datetime'];
    }

    public const INVENTORY_EXPENSE_STATUSES = ['PENDENTE', 'APROVADA', 'REALIZADA'];

    public function scopeEligibleForInventory(Builder $query): void
    {
        $query->where('tipo', 'DESPESA')->whereIn('status', self::INVENTORY_EXPENSE_STATUSES)->whereNull('origem_tipo')->whereNull('origem_id');
    }

    public function isEligibleForInventory(): bool
    {
        return $this->tipo === 'DESPESA' && in_array($this->status, self::INVENTORY_EXPENSE_STATUSES, true)
            && $this->origem_tipo === null && $this->origem_id === null;
    }

    public function entradasEstoque(): HasMany
    {
        return $this->hasMany(InventoryMovement::class, 'despesa_id');
    }

    public function ong(): BelongsTo
    {
        return $this->belongsTo(Ong::class, 'ong_id');
    }

    public function categoriaDespesa(): BelongsTo
    {
        return $this->belongsTo(ExpenseCategory::class, 'categoria_id');
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
