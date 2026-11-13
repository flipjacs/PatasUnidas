<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class AdoptionRequest extends Model
{
    protected $table = 'adoption_requests';

    protected $fillable = ['animal_id', 'usuario_id', 'ong_id', 'status', 'mensagem', 'justificativa_rejeicao', 'analisado_por', 'analisado_em', 'justificativa_cancelamento', 'cancelado_por', 'cancelado_em'];

    protected function casts(): array
    {
        return ['analisado_em' => 'datetime', 'cancelado_em' => 'datetime'];
    }

    public function animal(): BelongsTo
    {
        return $this->belongsTo(Animal::class, 'animal_id');
    }

    public function solicitante(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario_id');
    }

    public function ong(): BelongsTo
    {
        return $this->belongsTo(Ong::class, 'ong_id');
    }

    public function analisador(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'analisado_por');
    }

    public function cancelador(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'cancelado_por');
    }

    public function adocao(): HasOne
    {
        return $this->hasOne(Adoption::class, 'adoption_request_id');
    }
}
