<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnimalPhoto extends Model
{
    protected $table = 'animal_photos';

    protected $fillable = ['animal_id', 'caminho', 'principal'];

    protected function casts(): array
    {
        return ['principal' => 'boolean'];
    }

    public function animal(): BelongsTo
    {
        return $this->belongsTo(Animal::class, 'animal_id');
    }
}
