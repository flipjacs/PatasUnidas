<?php

namespace App\Http\Requests;

use App\Models\Donation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class FinancialMovementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $categories = $this->input('tipo') === 'RECEITA'
            ? ['EVENTO', 'OUTRA_RECEITA']
            : ['ALIMENTACAO', 'MEDICAMENTOS', 'VETERINARIO', 'TRANSPORTE', 'MANUTENCAO', 'OUTRA_DESPESA'];

        return [
            'tipo' => ['required', Rule::in(['RECEITA', 'DESPESA'])],
            'categoria' => [$this->input('tipo') === 'DESPESA' && $this->filled('categoriaId') ? 'sometimes' : 'required', Rule::in($categories)],
            'categoriaId' => ['sometimes', 'integer', Rule::exists('expense_categories', 'id')->where(function ($query): void {
                $query->where('ativo', true)->where(function ($query): void {
                    $query->whereNull('ong_id')->orWhere('ong_id', $this->user()?->ong_id);
                });
            })],
            'descricao' => ['required', 'string', 'max:255'],
            'valor' => ['required', 'string', Rule::regex(Donation::AMOUNT_PATTERN)],
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('descricao'))) {
            $this->merge(['descricao' => trim($this->input('descricao'))]);
        }
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($this->has('categoriaId') && $this->input('tipo') !== 'DESPESA') {
                $validator->errors()->add('categoriaId', 'Categoria disponível apenas para despesas.');
            }
            foreach (array_diff(array_keys($this->all()), array_keys($this->rules())) as $field) {
                $validator->errors()->add($field, 'Campo não permitido.');
            }
        }];
    }
}
