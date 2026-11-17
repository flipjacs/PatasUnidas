<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MedicalRecord extends Model
{
    public const TYPES = ['CONSULTA', 'VACINA', 'VERMIFUGACAO', 'EXAME', 'CIRURGIA', 'TRATAMENTO', 'MEDICACAO', 'OBSERVACAO'];

    protected $fillable = [
        'animal_id', 'ong_id', 'registrado_por', 'tipo', 'titulo', 'descricao',
        'data_procedimento', 'profissional_responsavel', 'medicamentos', 'observacoes',
    ];

    protected function casts(): array
    {
        return ['data_procedimento' => 'date:Y-m-d'];
    }

    public function animal(): BelongsTo
    {
        return $this->belongsTo(Animal::class, 'animal_id');
    }

    public function ong(): BelongsTo
    {
        return $this->belongsTo(Ong::class, 'ong_id');
    }

    public function registrador(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'registrado_por');
    }

    public function correcoes(): HasMany
    {
        return $this->hasMany(MedicalRecordCorrection::class, 'medical_record_id');
    }
}
