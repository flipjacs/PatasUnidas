<?php

namespace App\Http\Requests;

use App\Models\MedicalRecord;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class MedicalRecordCorrectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'justificativa' => ['required', 'string', 'max:2000'],
            'tipo' => ['sometimes', 'required', Rule::in(MedicalRecord::TYPES)],
            'titulo' => ['sometimes', 'required', 'string', 'max:120'],
            'descricao' => ['sometimes', 'required', 'string', 'max:10000'],
            'dataProcedimento' => ['sometimes', 'required', 'date_format:Y-m-d', 'before_or_equal:today'],
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
            if (count(array_intersect(array_keys($this->all()), array_keys($this->rules()))) < 2) {
                $validator->errors()->add('campos', 'Informe ao menos um campo clínico.');
            }
        }];
    }
}
