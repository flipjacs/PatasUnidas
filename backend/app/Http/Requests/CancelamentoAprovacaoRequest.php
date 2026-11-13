<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class CancelamentoAprovacaoRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('justificativa'))) {
            $this->merge(['justificativa' => trim($this->input('justificativa'))]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['justificativa' => ['required', 'string', 'max:1000']];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['justificativa']) as $field) {
                $validator->errors()->add($field, 'Campo não permitido.');
            }
        }];
    }
}
