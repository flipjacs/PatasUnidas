<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicalRecordCorrection extends Model
{
    public $timestamps = false;

    protected $fillable = ['medical_record_id', 'corrigido_por', 'justificativa', 'dados_anteriores', 'dados_novos'];

    protected function casts(): array
    {
        return ['dados_anteriores' => 'array', 'dados_novos' => 'array', 'created_at' => 'datetime'];
    }

    public function registro(): BelongsTo
    {
        return $this->belongsTo(MedicalRecord::class, 'medical_record_id');
    }

    public function responsavel(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'corrigido_por');
    }
}
