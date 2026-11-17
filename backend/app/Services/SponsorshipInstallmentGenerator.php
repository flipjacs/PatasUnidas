<?php

namespace App\Services;

use App\Models\Sponsorship;
use Carbon\CarbonImmutable;
use Symfony\Component\HttpKernel\Exception\HttpException;

class SponsorshipInstallmentGenerator
{
    public function ensureDue(Sponsorship $sponsorship, ?CarbonImmutable $through = null): void
    {
        if ($sponsorship->modalidade !== 'MENSAL' || $sponsorship->status !== 'ATIVO') {
            return;
        }

        $start = CarbonImmutable::instance($sponsorship->data_inicio);
        $today = ($through ?? CarbonImmutable::today())->startOfDay();
        $months = ($today->year - $start->year) * 12 + $today->month - $start->month;
        if ($months < 0) {
            return;
        }
        $target = $months + 1;
        if ($through !== null && $start->addMonthsNoOverflow($months)->isAfter($today)) {
            $target--;
        }
        if ($target > 240) {
            throw new HttpException(409, 'Período de parcelas excede o limite de 20 anos.');
        }

        $last = (int) $sponsorship->parcelas()->max('numero');
        if ($last >= $target) {
            return;
        }

        $now = now();
        $rows = [];
        for ($number = $last + 1; $number <= $target; $number++) {
            $rows[] = [
                'sponsorship_id' => $sponsorship->id,
                'numero' => $number,
                'valor' => $sponsorship->valor,
                'vencimento' => $start->addMonthsNoOverflow($number - 1)->toDateString(),
                'status' => 'PENDENTE',
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        $sponsorship->parcelas()->insert($rows);
    }
}
