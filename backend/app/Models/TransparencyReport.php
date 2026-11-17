<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TransparencyReport extends Model
{
    protected $fillable = [
        'ong_id', 'periodo_inicio', 'periodo_fim', 'titulo', 'descricao', 'status',
        'dados_consolidados', 'publicado_por', 'publicado_em', 'despublicado_em',
    ];

    protected function casts(): array
    {
        return [
            'periodo_inicio' => 'date',
            'periodo_fim' => 'date',
            'dados_consolidados' => 'array',
            'publicado_em' => 'datetime',
            'despublicado_em' => 'datetime',
        ];
    }

    public function ong(): BelongsTo
    {
        return $this->belongsTo(Ong::class, 'ong_id');
    }

    public function publicador(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'publicado_por');
    }
}
