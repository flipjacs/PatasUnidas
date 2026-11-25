<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryUnit extends Model
{
    public $timestamps = false;

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['fracionavel' => 'boolean'];
    }

    public function produtos(): HasMany
    {
        return $this->hasMany(InventoryProduct::class, 'unidade_id');
    }
}
