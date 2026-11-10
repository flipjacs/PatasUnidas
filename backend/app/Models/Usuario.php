<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;

class Usuario extends Authenticatable
{
    protected $table = 'usuario';

    public $timestamps = false;

    protected $fillable = ['nome', 'email', 'senha_hash', 'perfil', 'ong_id', 'ativo'];

    protected $hidden = ['senha_hash'];

    protected function casts(): array
    {
        return ['ativo' => 'boolean'];
    }

    public function getAuthPasswordName(): string
    {
        return 'senha_hash';
    }

    public function ong(): BelongsTo
    {
        return $this->belongsTo(Ong::class, 'ong_id');
    }
}
