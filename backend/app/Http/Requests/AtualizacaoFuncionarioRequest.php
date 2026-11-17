<?php

namespace App\Http\Requests;

use App\Models\Usuario;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class AtualizacaoFuncionarioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('manageEmployees', Usuario::class);
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('nome'))) {
            $this->merge(['nome' => trim($this->input('nome'))]);
        }
        if (is_string($this->input('email'))) {
            $this->merge(['email' => mb_strtolower(trim($this->input('email')))]);
        }
    }

    public function rules(): array
    {
        return [
            'nome' => ['sometimes', 'required', 'string', 'max:100'],
            'email' => ['sometimes', 'required', 'string', 'email', 'max:120', Rule::unique('usuario', 'email')->ignore($this->route('usuario')?->id)],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if (! $this->hasAny(['nome', 'email'])) {
                $validator->errors()->add('nome', 'Informe o nome ou o e-mail.');
            }
            foreach (array_diff(array_keys($this->all()), ['nome', 'email']) as $field) {
                $validator->errors()->add($field, 'Campo não permitido.');
            }
        }];
    }
}
