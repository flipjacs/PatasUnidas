<?php

namespace Tests\Feature;

use App\Models\AdoptionRequest;
use App\Models\Animal;
use App\Models\FinancialTransaction;
use App\Models\Ong;
use App\Models\Sponsorship;
use App\Models\Usuario;
use App\Services\SponsorshipClosureService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SponsorshipCompletionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://127.0.0.1:5174');
    }

    private function ong(): Ong
    {
        return Ong::create(['nome' => 'ONG F7.2', 'email' => uniqid().'@example.test', 'status' => 'ATIVA']);
    }

    private function user(string $role = 'usuario', ?Ong $ong = null, bool $active = true): Usuario
    {
        return Usuario::create([
            'nome' => 'Pessoa F7.2', 'email' => uniqid().'@example.test',
            'senha_hash' => Hash::make('Oito123!'), 'perfil' => $role,
            'ong_id' => $ong?->id, 'ativo' => $active,
        ]);
    }

    private function animal(Ong $ong): Animal
    {
        return Animal::create([
            'ong_id' => $ong->id, 'nome' => 'Animal F7.2', 'especie' => 'GATO',
            'sexo' => 'FEMEA', 'porte' => 'PEQUENO', 'idade_aproximada' => 12,
            'situacao' => 'DISPONIVEL', 'publicado' => true,
        ]);
    }

    private function sponsor(Animal $animal): Sponsorship
    {
        $record = Sponsorship::create([
            'animal_id' => $animal->id, 'ong_id' => $animal->ong_id,
            'usuario_id' => $this->user()->id, 'modalidade' => 'MENSAL',
            'valor' => '35.50', 'status' => 'ATIVO', 'data_inicio' => today()->toDateString(),
        ]);
        $record->parcelas()->create([
            'numero' => 1, 'valor' => '35.50', 'vencimento' => today()->toDateString(), 'status' => 'PENDENTE',
        ]);

        return $record;
    }

    private function confirmUrl(Sponsorship $record, int $installment): string
    {
        return "/api/v1/ong/sponsorships/{$record->id}/parcelas/{$installment}/confirmar";
    }

    public function test_confirmation_creates_one_revenue_and_updates_balance(): void
    {
        $ong = $this->ong();
        $record = $this->sponsor($this->animal($ong));
        $part = $record->parcelas()->firstOrFail();
        $admin = $this->user('administrador', $ong);
        $url = $this->confirmUrl($record, $part->id);
        $this->actingAs($admin);
        $this->getJson('/api/v1/ong/finance/resumo')->assertJsonPath('saldoRealizado', '0.00');
        $this->patchJson($url)->assertOk()->assertJsonPath('status', 'CONFIRMADA')
            ->assertJsonPath('confirmadoPor.id', $admin->id);
        $this->assertNotNull($part->fresh()->confirmado_em);
        $this->assertDatabaseHas('financial_transactions', [
            'ong_id' => $ong->id, 'origem_tipo' => 'APADRINHAMENTO', 'origem_id' => $part->id,
            'tipo' => 'RECEITA', 'categoria' => 'APADRINHAMENTO', 'status' => 'REALIZADA',
            'valor' => '35.50', 'confirmado_por' => $admin->id,
        ]);
        $this->getJson('/api/v1/ong/finance/resumo')->assertJsonPath('saldoRealizado', '35.50');
        $this->patchJson($url)->assertConflict();
        $this->assertDatabaseCount('financial_transactions', 1);
        $financeId = FinancialTransaction::firstOrFail()->id;
        $this->patchJson("/api/v1/ong/finance/movimentacoes/{$financeId}/cancelar")->assertConflict();
        $this->patchJson("/api/v1/ong/finance/movimentacoes/{$financeId}/confirmar-recebimento")->assertConflict();
    }

    public function test_confirmation_is_isolated_and_requires_active_administrator(): void
    {
        $ong = $this->ong();
        $record = $this->sponsor($this->animal($ong));
        $part = $record->parcelas()->firstOrFail();
        $url = $this->confirmUrl($record, $part->id);
        $this->patchJson($url)->assertUnauthorized();
        foreach (['voluntario', 'veterinario', 'usuario', 'criador_plataforma'] as $role) {
            $staffOng = in_array($role, ['voluntario', 'veterinario']) ? $ong : null;
            $this->actingAs($this->user($role, $staffOng))->patchJson($url)->assertForbidden();
            $this->postJson('/api/v1/auth/logout')->assertOk();
        }
        $this->actingAs($this->user('administrador', $this->ong()))->patchJson($url)->assertNotFound();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($this->user('administrador', $ong, false))->patchJson($url)->assertUnauthorized();
        $this->actingAs($this->user('administrador', $ong));
        $this->patchJson($url, ['valor' => '1.00'])->assertStatus(400);
        $other = $this->sponsor($this->animal($ong));
        $this->patchJson($this->confirmUrl($record, $other->parcelas()->firstOrFail()->id))->assertNotFound();
        $ong->update(['status' => 'SUSPENSA']);
        $this->patchJson($url)->assertForbidden();
        $this->assertDatabaseCount('financial_transactions', 0);
    }

    public function test_closed_receivable_can_be_confirmed_and_cancelled_part_cannot(): void
    {
        $ong = $this->ong();
        $record = $this->sponsor($this->animal($ong));
        $part = $record->parcelas()->firstOrFail();
        $record->update(['status' => 'ENCERRADO', 'data_encerramento' => today()->toDateString()]);
        $this->actingAs($this->user('administrador', $ong))
            ->patchJson($this->confirmUrl($record, $part->id))->assertOk();
        $this->assertSame('ENCERRADO', $record->fresh()->status);
        $other = $this->sponsor($this->animal($ong));
        $cancelled = $other->parcelas()->firstOrFail();
        $cancelled->update(['status' => 'CANCELADA']);
        $this->patchJson($this->confirmUrl($other, $cancelled->id))->assertConflict();
        $this->assertDatabaseCount('financial_transactions', 1);
    }

    public function test_financial_write_failure_rolls_back_installment_confirmation(): void
    {
        $ong = $this->ong();
        $record = $this->sponsor($this->animal($ong));
        $part = $record->parcelas()->firstOrFail();
        FinancialTransaction::creating(fn () => throw new \RuntimeException('Falha financeira simulada'));
        $this->withoutExceptionHandling();
        $this->actingAs($this->user('administrador', $ong));
        try {
            $this->patchJson($this->confirmUrl($record, $part->id));
            $this->fail('A falha financeira deveria interromper a confirmação.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('Falha financeira simulada', $exception->getMessage());
        }
        $this->assertSame('PENDENTE', $part->fresh()->status);
        $this->assertNull($part->fresh()->confirmado_em);
        $this->assertDatabaseCount('financial_transactions', 0);
    }

    public function test_admin_filters_materialized_monthly_installments(): void
    {
        $this->travelTo(now()->setDate(2026, 1, 31));
        $ong = $this->ong();
        $record = $this->sponsor($this->animal($ong));
        $this->travelTo(now()->setDate(2026, 3, 1));
        $this->actingAs($this->user('voluntario', $ong));
        $url = "/api/v1/ong/sponsorships/{$record->id}/parcelas";
        $this->getJson($url.'?vencidas=1')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson($url.'?de=2026-03-01&ate=2026-03-31')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.vencimento', '2026-03-31');
        $this->assertSame(3, $record->parcelas()->count());
    }

    public function test_installment_list_query_count_does_not_grow_with_confirmers(): void
    {
        $ong = $this->ong();
        $record = $this->sponsor($this->animal($ong));
        $admin = $this->user('administrador', $ong);
        $record->parcelas()->firstOrFail()->update(['status' => 'CONFIRMADA', 'confirmado_por' => $admin->id, 'confirmado_em' => now()]);
        for ($number = 2; $number <= 15; $number++) {
            $record->parcelas()->create([
                'numero' => $number, 'valor' => '35.50',
                'vencimento' => today()->addDays($number)->toDateString(),
                'status' => 'CONFIRMADA', 'confirmado_por' => $admin->id, 'confirmado_em' => now(),
            ]);
        }
        $this->actingAs($admin);
        $url = "/api/v1/ong/sponsorships/{$record->id}/parcelas";
        DB::enableQueryLog();
        $this->getJson($url.'?ate='.today()->toDateString())->assertOk()->assertJsonCount(1, 'data');
        $one = count(DB::getQueryLog());
        DB::flushQueryLog();
        $this->getJson($url)->assertOk()->assertJsonCount(15, 'data');
        $fifteen = count(DB::getQueryLog());
        DB::disableQueryLog();
        $this->assertSame($one, $fifteen);
    }

    public function test_adoption_closes_active_sponsors_at_event_date(): void
    {
        $this->travelTo(now()->setDate(2026, 1, 31));
        $ong = $this->ong();
        $animal = $this->animal($ong);
        $first = $this->sponsor($animal);
        $second = $this->sponsor($animal);
        $ended = $this->sponsor($animal);
        $ended->update(['status' => 'ENCERRADO', 'data_encerramento' => today()->toDateString(), 'motivo_encerramento' => 'CANCELAMENTO_USUARIO']);
        $request = AdoptionRequest::create([
            'animal_id' => $animal->id, 'ong_id' => $ong->id,
            'usuario_id' => $this->user()->id, 'status' => 'APROVADA',
        ]);
        $animal->update(['situacao' => 'EM_PROCESSO_ADOCAO']);
        $this->travelTo(now()->setDate(2026, 3, 1));
        $this->actingAs($this->user('administrador', $ong))
            ->postJson("/api/v1/ong/adoption-requests/{$request->id}/confirmar-entrega")->assertOk();
        $this->assertSame('ADOTADO', $animal->fresh()->situacao);
        foreach ([$first, $second] as $record) {
            $this->assertDatabaseHas('sponsorships', [
                'id' => $record->id, 'status' => 'ENCERRADO', 'motivo_encerramento' => 'ADOCAO_CONCLUIDA',
            ]);
            $this->assertSame('2026-03-01', $record->fresh()->data_encerramento->toDateString());
            $this->assertSame(2, $record->parcelas()->count());
        }
        $this->assertSame('CANCELAMENTO_USUARIO', $ended->fresh()->motivo_encerramento);
        $this->assertSame(1, $ended->parcelas()->count());
        $this->assertDatabaseCount('adoptions', 1);
        $this->travelTo(now()->setDate(2026, 5, 1));
        $this->getJson("/api/v1/ong/sponsorships/{$first->id}/parcelas")->assertJsonCount(2, 'data');
    }

    public function test_death_closes_sponsors_and_rolls_back_when_generator_fails(): void
    {
        $this->travelTo(now()->setDate(2026, 1, 31));
        $ong = $this->ong();
        $animal = $this->animal($ong);
        $record = $this->sponsor($animal);
        $this->travelTo(now()->setDate(2026, 3, 1));
        $this->actingAs($this->user('administrador', $ong))
            ->patchJson("/api/v1/ong/animais/{$animal->id}/situacao", ['situacao' => 'FALECIDO'])->assertOk();
        $this->assertSame('FALECIDO', $animal->fresh()->situacao);
        $this->assertSame('FALECIMENTO_ANIMAL', $record->fresh()->motivo_encerramento);
        $this->assertSame(2, $record->parcelas()->count());

        $other = $this->animal($ong);
        $this->sponsor($other);
        $this->app->bind(SponsorshipClosureService::class, fn () => throw new \RuntimeException('Falha simulada'));
        $this->withoutExceptionHandling();
        try {
            $this->patchJson("/api/v1/ong/animais/{$other->id}/situacao", ['situacao' => 'FALECIDO']);
            $this->fail('A falha simulada deveria impedir o encerramento.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('Falha simulada', $exception->getMessage());
        }
        $this->assertSame('DISPONIVEL', $other->fresh()->situacao);
    }

    public function test_adoption_rolls_back_if_sponsorship_closure_fails(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong);
        $record = $this->sponsor($animal);
        $request = AdoptionRequest::create([
            'animal_id' => $animal->id, 'ong_id' => $ong->id,
            'usuario_id' => $this->user()->id, 'status' => 'APROVADA',
        ]);
        $animal->update(['situacao' => 'EM_PROCESSO_ADOCAO']);
        $this->app->bind(SponsorshipClosureService::class, fn () => throw new \RuntimeException('Falha simulada'));
        $this->withoutExceptionHandling();
        $this->actingAs($this->user('administrador', $ong));
        try {
            $this->postJson("/api/v1/ong/adoption-requests/{$request->id}/confirmar-entrega");
            $this->fail('A falha simulada deveria interromper a adoção.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('Falha simulada', $exception->getMessage());
        }
        $this->assertSame('EM_PROCESSO_ADOCAO', $animal->fresh()->situacao);
        $this->assertSame('APROVADA', $request->fresh()->status);
        $this->assertSame('ATIVO', $record->fresh()->status);
        $this->assertDatabaseCount('adoptions', 0);
    }
}
