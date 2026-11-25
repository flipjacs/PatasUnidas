<?php

namespace App\Http\Requests;

use App\Models\InventoryProduct;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class InventoryProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('create', InventoryProduct::class);
    }

    protected function prepareForValidation(): void
    {
        foreach (['nome', 'marca', 'codigoInterno', 'descricao', 'observacoes'] as $field) {
            if (is_string($this->input($field))) {
                $value = trim($this->input($field));
                $this->merge([$field => $field !== 'nome' && $value === '' ? null : $value]);
            }
        }
        if (is_string($this->input('codigoInterno'))) {
            $this->merge(['codigoInterno' => mb_strtoupper($this->input('codigoInterno'))]);
        }
    }

    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'nome' => [$required, 'string', 'min:2', 'max:150'],
            'marca' => ['sometimes', 'nullable', 'string', 'max:100'],
            'codigoInterno' => ['sometimes', 'nullable', 'string', 'max:60'],
            'descricao' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'observacoes' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'categoriaId' => [$required, 'integer', Rule::exists('inventory_categories', 'id')->where(fn ($q) => $q->where('ativo', true)->where(fn ($q) => $q->whereNull('ong_id')->orWhere('ong_id', $this->user()->ong_id)))],
            'unidadeId' => [$required, 'integer', Rule::exists('inventory_units', 'id')],
            'localId' => ['sometimes', 'nullable', 'integer', Rule::exists('storage_locations', 'id')->where(fn ($q) => $q->where('ativo', true)->where('ong_id', $this->user()->ong_id))],
            'controlaValidade' => ['sometimes', 'boolean'],
            'quantidadeMinima' => ['sometimes', 'string', 'regex:/\A(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?\z/'],
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
