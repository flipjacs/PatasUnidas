<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ExpenseCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['nome' => ['required', 'string', 'min:2', 'max:100']];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('nome'))) {
            $this->merge(['nome' => trim($this->input('nome'))]);
        }
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['nome']) as $field) {
                $validator->errors()->add($field, 'Campo não permitido.');
            }
        }];
    }
}
