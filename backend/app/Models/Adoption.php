<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Adoption extends Model
{
    protected $table = 'adoptions';

    protected $fillable = ['adoption_request_id', 'animal_id', 'usuario_id', 'ong_id', 'confirmado_por', 'data_entrega'];

    protected function casts(): array
    {
        return ['data_entrega' => 'datetime'];
    }

    public function solicitacao(): BelongsTo
    {
        return $this->belongsTo(AdoptionRequest::class, 'adoption_request_id');
    }

    public function animal(): BelongsTo
    {
        return $this->belongsTo(Animal::class, 'animal_id');
    }

    public function adotante(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario_id');
    }

    public function ong(): BelongsTo
    {
        return $this->belongsTo(Ong::class, 'ong_id');
    }

    public function confirmador(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'confirmado_por');
    }
}
