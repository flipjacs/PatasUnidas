<?php

namespace App\Services;

use App\Models\Animal;
use App\Models\Sponsorship;
use Carbon\CarbonImmutable;

class SponsorshipClosureService
{
    public function __construct(private SponsorshipInstallmentGenerator $generator) {}

    // The caller holds the animal lock and owns the transaction.
    public function closeForAnimal(Animal $animal, string $reason, CarbonImmutable $eventAt): void
    {
        $sponsorships = Sponsorship::query()->where('animal_id', $animal->id)
            ->where('status', 'ATIVO')->orderBy('id')->lockForUpdate()->get();

        foreach ($sponsorships as $sponsorship) {
            $this->generator->ensureDue($sponsorship, $eventAt);
            $sponsorship->update([
                'status' => 'ENCERRADO',
                'motivo_encerramento' => $reason,
                'data_encerramento' => $eventAt->toDateString(),
            ]);
        }
    }
}
