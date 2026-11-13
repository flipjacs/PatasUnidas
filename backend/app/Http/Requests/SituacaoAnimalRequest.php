<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SituacaoAnimalRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['situacao' => ['required', 'string', 'in:DISPONIVEL,INDISPONIVEL,FALECIDO']];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['situacao']) as $field) {
                $validator->errors()->add($field, 'Campo não permitido.');
            }
        }];
    }
}
