<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class OngRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        foreach (['nome', 'cnpj_cpf', 'email', 'telefone', 'cidade', 'estado'] as $field) {
            if (is_string($this->input($field))) {
                $value = trim($this->input($field));
                $this->merge([$field => $field === 'email' ? mb_strtolower($value) : $value]);
            }
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'nome' => [$required, 'string', 'max:120'],
            'email' => [$required, 'email', 'max:120'],
            'cnpj_cpf' => ['sometimes', 'nullable', 'string', 'max:20'],
            'telefone' => ['sometimes', 'nullable', 'string', 'max:20'],
            'cidade' => ['sometimes', 'nullable', 'string', 'max:80'],
            'estado' => ['sometimes', 'nullable', 'string', 'size:2'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), array_keys($this->rules())) as $field) {
                $validator->errors()->add($field, 'Campo não permitido.');
            }
        }];
    }
}
