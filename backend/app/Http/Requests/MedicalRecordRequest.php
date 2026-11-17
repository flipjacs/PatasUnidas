<?php

namespace App\Http\Requests;

use App\Models\MedicalRecord;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class MedicalRecordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tipo' => ['required', Rule::in(MedicalRecord::TYPES)],
            'titulo' => ['required', 'string', 'max:120'],
            'descricao' => ['required', 'string', 'max:10000'],
            'dataProcedimento' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'profissionalResponsavel' => ['sometimes', 'nullable', 'string', 'max:120'],
            'medicamentos' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'observacoes' => ['sometimes', 'nullable', 'string', 'max:5000'],
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
