<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

abstract class CadastroRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'nome' => is_string($this->input('nome')) ? trim($this->input('nome')) : $this->input('nome'),
            'email' => is_string($this->input('email')) ? mb_strtolower(trim($this->input('email'))) : $this->input('email'),
        ]);
    }

    protected function commonRules(): array
    {
        return [
            'nome' => ['required', 'string', 'max:100'],
            'email' => ['required', 'string', 'email', 'max:120'],
            'senha' => ['required', 'string', 'min:8', 'max:72', function (string $attribute, mixed $value, \Closure $fail): void {
                if (is_string($value) && (strlen($value) > 72 || trim($value) === '')) {
                    $fail('A senha é inválida ou excede 72 bytes.');
                }
            }],
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
