<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Ong extends Model
{
    protected $table = 'ong';

    public $timestamps = false;

    protected $guarded = ['id'];

    public function usuarios(): HasMany
    {
        return $this->hasMany(Usuario::class, 'ong_id');
    }
}
