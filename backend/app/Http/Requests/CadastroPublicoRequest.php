<?php

namespace App\Http\Requests;

class CadastroPublicoRequest extends CadastroRequest
{
    public function rules(): array
    {
        return $this->commonRules();
    }
}
