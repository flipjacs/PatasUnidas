<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
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

    public function solicitacoesAdocao(): HasMany
    {
        return $this->hasMany(AdoptionRequest::class, 'usuario_id');
    }

    public function doacoes(): HasMany
    {
        return $this->hasMany(Donation::class, 'usuario_id');
    }

    public function prontuariosRegistrados(): HasMany
    {
        return $this->hasMany(MedicalRecord::class, 'registrado_por');
    }

    public function correcoesClinicas(): HasMany
    {
        return $this->hasMany(MedicalRecordCorrection::class, 'corrigido_por');
    }

    public function apadrinhamentos(): HasMany
    {
        return $this->hasMany(Sponsorship::class, 'usuario_id');
    }
}
