<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Animal extends Model
{
    protected $table = 'animal';

    protected $fillable = ['ong_id', 'nome', 'especie', 'sexo', 'porte', 'idade_aproximada', 'descricao', 'situacao', 'publicado'];

    protected function casts(): array
    {
        return ['idade_aproximada' => 'integer', 'publicado' => 'boolean'];
    }

    public function ong(): BelongsTo
    {
        return $this->belongsTo(Ong::class, 'ong_id');
    }

    public function fotos(): HasMany
    {
        return $this->hasMany(AnimalPhoto::class, 'animal_id');
    }

    public function fotoPrincipal(): HasOne
    {
        return $this->hasOne(AnimalPhoto::class, 'animal_id')->where('principal', true);
    }

    public function solicitacoes(): HasMany
    {
        return $this->hasMany(AdoptionRequest::class, 'animal_id');
    }

    public function adocao(): HasOne
    {
        return $this->hasOne(Adoption::class, 'animal_id');
    }
}
