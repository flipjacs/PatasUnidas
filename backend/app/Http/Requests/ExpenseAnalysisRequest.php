<?php

namespace App\Http\Requests;

use App\Models\Ong;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Validator;

class ExpenseAnalysisRequest extends ReportPeriodRequest
{
    public function authorize(): bool
    {
        return Gate::allows('viewFinancialReport', Ong::class);
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'de' => $this->input('de', now()->startOfYear()->toDateString()),
            'ate' => $this->input('ate', now()->toDateString()),
        ]);
    }

    public function after(): array
    {
        return [...parent::after(), function (Validator $validator): void {
            if ($validator->errors()->isEmpty() && Carbon::parse($this->input('de'))->diffInDays(Carbon::parse($this->input('ate'))) > 1095) {
                $validator->errors()->add('ate', 'O período máximo é de 1095 dias.');
            }
        }];
    }
}
