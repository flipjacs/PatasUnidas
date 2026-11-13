<?php

namespace App\Http\Requests;

use App\Models\Usuario;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class CadastroInternoRequest extends CadastroRequest
{
    public function authorize(): bool
    {
        return Gate::allows('createInternal', Usuario::class);
    }

    public function rules(): array
    {
        return [...$this->commonRules(), 'perfil' => ['required', Rule::in(['VOLUNTARIO', 'VETERINARIO'])]];
    }
}
