<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class TransparencyReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';
        $endRules = [$required, 'date_format:Y-m-d'];
        if ($this->isMethod('post') || $this->filled('periodoInicio')) {
            $endRules[] = 'after_or_equal:periodoInicio';
        }

        return [
            'titulo' => [$required, 'string', 'max:120'],
            'descricao' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'periodoInicio' => [$required, 'date_format:Y-m-d'],
            'periodoFim' => $endRules,
        ];
    }

    protected function prepareForValidation(): void
    {
        foreach (['titulo', 'descricao'] as $field) {
            if (is_string($this->input($field))) {
                $this->merge([$field => trim($this->input($field))]);
            }
        }
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
