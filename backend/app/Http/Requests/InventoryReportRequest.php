<?php

namespace App\Http\Requests;

use App\Models\InventoryCategory;
use App\Models\InventoryProduct;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class InventoryReportRequest extends ReportPeriodRequest
{
    public function authorize(): bool
    {
        return Gate::allows('viewAny', InventoryProduct::class);
    }

    protected function prepareForValidation(): void
    {
        if ($this->routeIs('stock.reports.summary')) {
            $this->merge(['de' => $this->input('de', now()->startOfYear()->toDateString()), 'ate' => $this->input('ate', now()->toDateString())]);
        }
    }

    public function rules(): array
    {
        $rules = [
            'categoriaId' => ['sometimes', 'integer', 'min:1'],
            'produtoId' => ['sometimes', 'integer', 'min:1'],
            'unidadeId' => ['sometimes', 'integer', 'min:1', Rule::exists('inventory_units', 'id')],
        ];

        return $this->routeIs('stock.reports.summary')
            ? [...parent::rules(), ...$rules, 'limiteRanking' => ['sometimes', 'integer', 'between:1,20']]
            : [...$rules, 'page' => ['sometimes', 'integer', 'min:1']];
    }

    public function after(): array
    {
        return [...parent::after(), function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            if ($this->filled('de') && Carbon::parse($this->input('de'))->diffInDays(Carbon::parse($this->input('ate'))) > 1095) {
                $validator->errors()->add('ate', 'O período máximo é de 1095 dias.');
            }
            if ($this->filled('categoriaId')) {
                InventoryCategory::where(fn ($query) => $query->whereNull('ong_id')->orWhere('ong_id', $this->user()->ong_id))->findOrFail($this->input('categoriaId'));
            }
            if ($this->filled('produtoId')) {
                InventoryProduct::where('ong_id', $this->user()->ong_id)->findOrFail($this->input('produtoId'));
            }
        }];
    }
}
