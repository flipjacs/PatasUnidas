<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Ong extends Model
{
    protected $table = 'ong';

    public $timestamps = false;

    protected $fillable = ['nome', 'cnpj_cpf', 'email', 'telefone', 'cidade', 'estado', 'status'];

    public function usuarios(): HasMany
    {
        return $this->hasMany(Usuario::class, 'ong_id');
    }

    public function animais(): HasMany
    {
        return $this->hasMany(Animal::class, 'ong_id');
    }

    public function solicitacoesAdocao(): HasMany
    {
        return $this->hasMany(AdoptionRequest::class, 'ong_id');
    }

    public function doacoes(): HasMany
    {
        return $this->hasMany(Donation::class, 'ong_id');
    }

    public function prontuarios(): HasMany
    {
        return $this->hasMany(MedicalRecord::class, 'ong_id');
    }

    public function apadrinhamentos(): HasMany
    {
        return $this->hasMany(Sponsorship::class, 'ong_id');
    }

    public function demonstrativos(): HasMany
    {
        return $this->hasMany(TransparencyReport::class, 'ong_id');
    }
}
