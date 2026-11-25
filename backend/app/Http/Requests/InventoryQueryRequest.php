<?php

namespace App\Http\Requests;

use App\Models\InventoryProduct;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class InventoryQueryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('viewAny', InventoryProduct::class);
    }

    public function rules(): array
    {
        $scope = fn ($q) => $q->where('ong_id', $this->user()->ong_id);
        $rules = ['page' => ['sometimes', 'integer', 'min:1']];
        if ($this->routeIs('stock.alerts')) {
            return $rules + ['tipo' => ['required', Rule::in(['BAIXO', 'ESGOTADO', 'VENCIDO', 'PROXIMO_VENCIMENTO'])], 'dias' => ['sometimes', 'integer', 'min:1', 'max:365']];
        }
        if ($this->routeIs('stock.lots')) {
            return $rules;
        }

        return $rules + ['despesaId' => ['sometimes', 'integer', 'min:1'], 'produtoId' => ['sometimes', 'integer', Rule::exists('inventory_products', 'id')->where($scope)], 'loteId' => ['sometimes', 'integer', Rule::exists('inventory_lots', 'id')->where($scope)], 'responsavelId' => ['sometimes', 'integer', Rule::exists('usuario', 'id')->where($scope)], 'tipo' => ['sometimes', Rule::in(['ENTRADA_COMPRA', 'ENTRADA_DOACAO', 'ENTRADA_DEVOLUCAO', 'AJUSTE_POSITIVO', 'SAIDA_CONSUMO', 'SAIDA_PERDA', 'SAIDA_DESCARTE', 'AJUSTE_NEGATIVO'])], 'de' => ['sometimes', 'date_format:Y-m-d'], 'ate' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:de']];
    }

    public function after(): array
    {
        return [function (Validator $v): void {
            foreach (array_diff(array_keys($this->all()), array_keys($this->rules())) as $k) {
                $v->errors()->add($k, 'Filtro não permitido.');
            }
        }];
    }
}
