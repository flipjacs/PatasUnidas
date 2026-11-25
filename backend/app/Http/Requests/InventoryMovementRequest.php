<?php

namespace App\Http\Requests;

use App\Models\InventoryProduct;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class InventoryMovementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows($this->routeIs('stock.adjust') ? 'adjust' : 'create', InventoryProduct::class);
    }

    public function rules(): array
    {
        $types = $this->routeIs('stock.adjust') ? ['AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'] : ($this->routeIs('stock.entry') ? ['ENTRADA_COMPRA', 'ENTRADA_DOACAO', 'ENTRADA_DEVOLUCAO'] : ['SAIDA_CONSUMO', 'SAIDA_PERDA', 'SAIDA_DESCARTE']);

        return ['despesaId' => ['sometimes', 'nullable', 'integer', 'min:1', Rule::prohibitedIf(fn () => $this->input('tipo') !== 'ENTRADA_COMPRA')], 'produtoId' => ['required', 'integer', 'min:1'], 'tipo' => ['required', Rule::in($types)], 'quantidade' => ['required', 'string', 'regex:/\A(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?\z/', 'not_regex:/\A0(?:\.0+)?\z/'],
            'motivo' => ['required', 'string', 'min:3', 'max:2000'], 'observacoes' => ['sometimes', 'nullable', 'string', 'max:2000'], 'chaveOperacao' => ['required', 'uuid'],
            'loteId' => ['sometimes', 'nullable', 'integer', 'min:1'], 'lote' => ['sometimes', 'array:codigo,validade', Rule::prohibitedIf(fn () => $this->filled('loteId'))],
            'lote.codigo' => ['required_with:lote', 'string', 'min:1', 'max:100'], 'lote.validade' => ['sometimes', 'nullable', 'date_format:Y-m-d']];
    }

    public function after(): array
    {
        return [function (Validator $v): void {
            foreach (array_diff(array_keys($this->all()), array_keys($this->rules())) as $key) {
                $v->errors()->add($key, 'Campo não permitido.');
            }
        }];
    }
}
