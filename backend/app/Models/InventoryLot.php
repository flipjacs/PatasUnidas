<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryLot extends Model
{
    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['quantidade_disponivel' => 'decimal:3', 'validade' => 'date:Y-m-d'];
    }

    public function produto(): BelongsTo
    {
        return $this->belongsTo(InventoryProduct::class, 'produto_id');
    }
}
