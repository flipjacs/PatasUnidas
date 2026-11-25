<?php

namespace App\Http\Requests;

use App\Models\InventoryProduct;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Validator;

class InventoryReferenceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('manageReferences', InventoryProduct::class);
    }

    protected function prepareForValidation(): void
    {
        foreach (['nome', 'descricao'] as $field) {
            if (is_string($this->input($field))) {
                $this->merge([$field => trim($this->input($field))]);
            }
        }
    }

    public function rules(): array
    {
        $rules = ['nome' => [$this->isMethod('post') ? 'required' : 'sometimes', 'string', 'min:2', 'max:100']];
        if ($this->routeIs('stock.locations.*')) {
            $rules['descricao'] = ['sometimes', 'nullable', 'string', 'max:2000'];
        }

        return $rules;
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
