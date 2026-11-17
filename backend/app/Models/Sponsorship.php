<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Sponsorship extends Model
{
    protected $fillable = [
        'animal_id', 'ong_id', 'usuario_id', 'modalidade', 'valor', 'status',
        'data_inicio', 'data_encerramento', 'motivo_encerramento', 'justificativa_encerramento',
    ];

    protected function casts(): array
    {
        return ['valor' => 'decimal:2', 'data_inicio' => 'date', 'data_encerramento' => 'date'];
    }

    public function animal(): BelongsTo
    {
        return $this->belongsTo(Animal::class, 'animal_id');
    }

    public function ong(): BelongsTo
    {
        return $this->belongsTo(Ong::class, 'ong_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario_id');
    }

    public function parcelas(): HasMany
    {
        return $this->hasMany(SponsorshipInstallment::class, 'sponsorship_id');
    }

    public function primeiraParcela(): HasOne
    {
        return $this->hasOne(SponsorshipInstallment::class, 'sponsorship_id')->where('numero', 1);
    }
}
