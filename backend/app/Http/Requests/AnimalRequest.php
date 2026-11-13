<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class AnimalRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        foreach (['nome', 'descricao'] as $field) {
            if (is_string($this->input($field))) {
                $this->merge([$field => trim($this->input($field))]);
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
            'nome' => [$required, 'string', 'max:100'],
            'especie' => [$required, Rule::in(['CACHORRO', 'GATO', 'OUTRO'])],
            'sexo' => [$required, Rule::in(['MACHO', 'FEMEA', 'NAO_INFORMADO'])],
            'porte' => [$required, Rule::in(['PEQUENO', 'MEDIO', 'GRANDE', 'NAO_INFORMADO'])],
            'idade_aproximada' => [$required, 'integer', 'min:0', 'max:1200'],
            'descricao' => ['sometimes', 'nullable', 'string', 'max:2000'],
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
