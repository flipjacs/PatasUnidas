<?php

namespace Tests\Feature;

use App\Models\Animal;
use App\Models\Ong;
use App\Models\Sponsorship;
use App\Models\Usuario;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SponsorshipApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://127.0.0.1:5174');
    }

    private function ong(string $status = 'ATIVA'): Ong
    {
        return Ong::create(['nome' => 'ONG Teste', 'email' => uniqid().'@example.org', 'status' => $status]);
    }

    private function animal(Ong $ong, array $extra = []): Animal
    {
        return Animal::create([
            'ong_id' => $ong->id, 'nome' => 'Thor', 'especie' => 'CACHORRO',
            'sexo' => 'MACHO', 'porte' => 'MEDIO', 'idade_aproximada' => 36,
            'situacao' => 'DISPONIVEL', 'publicado' => true, ...$extra,
        ]);
    }

    private function user(string $perfil = 'usuario', ?int $ongId = null, bool $active = true): Usuario
    {
        return Usuario::create([
            'nome' => 'Pessoa', 'email' => uniqid().'@example.org',
            'senha_hash' => Hash::make('Oito123!'), 'perfil' => $perfil,
            'ong_id' => $ongId, 'ativo' => $active,
        ]);
    }

    private function sponsorship(Animal $animal, Usuario $user, string $modalidade = 'UNICO'): Sponsorship
    {
        $record = Sponsorship::create([
            'animal_id' => $animal->id, 'ong_id' => $animal->ong_id,
            'usuario_id' => $user->id, 'modalidade' => $modalidade,
            'valor' => '12.34', 'status' => 'ATIVO', 'data_inicio' => today()->toDateString(),
        ]);
        $record->parcelas()->create([
            'numero' => 1, 'valor' => '12.34', 'vencimento' => today()->toDateString(), 'status' => 'PENDENTE',
        ]);

        return $record;
    }

    public function test_public_user_creates_unique_sponsorship_with_first_pending_installment(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong);
        $user = $this->user();

        $response = $this->actingAs($user)->postJson('/api/v1/sponsorships', [
            'animalId' => $animal->id, 'modalidade' => 'UNICO', 'valor' => '30.25',
        ])->assertCreated()->assertJsonPath('modalidade', 'UNICO')->assertJsonPath('status', 'ATIVO')
            ->assertJsonPath('primeiraParcela.numero', 1)->assertJsonPath('primeiraParcela.status', 'PENDENTE');

        $id = $response->json('id');
        $this->assertDatabaseHas('sponsorships', [
            'id' => $id, 'animal_id' => $animal->id, 'ong_id' => $ong->id,
            'usuario_id' => $user->id, 'valor' => '30.25', 'status' => 'ATIVO',
        ]);
        $this->assertDatabaseHas('sponsorship_installments', [
            'sponsorship_id' => $id, 'numero' => 1, 'valor' => '30.25', 'status' => 'PENDENTE',
        ]);
        $this->assertSame(1, DB::table('sponsorship_installments')->count());
        $this->assertDatabaseCount('financial_transactions', 0);
    }

    public function test_monthly_installments_are_due_by_current_month_without_day_drift_or_duplicates(): void
    {
        $this->travelTo(now()->setDate(2026, 1, 31)->setTime(10, 0));
        $animal = $this->animal($this->ong());
        $user = $this->user();
        $id = $this->actingAs($user)->postJson('/api/v1/sponsorships', [
            'animalId' => $animal->id, 'modalidade' => 'MENSAL', 'valor' => '19.99',
        ])->assertCreated()->assertJsonPath('primeiraParcela.vencimento', '2026-01-31')->json('id');

        $this->travelTo(now()->setDate(2026, 3, 1)->setTime(10, 0));
        $url = "/api/v1/me/sponsorships/{$id}/parcelas";
        $this->getJson($url)->assertOk()->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.vencimento', '2026-01-31')
            ->assertJsonPath('data.1.vencimento', '2026-02-28')
            ->assertJsonPath('data.2.vencimento', '2026-03-31')
            ->assertJsonPath('data.0.vencida', true)
            ->assertJsonPath('data.2.vencida', false);
        $this->getJson($url)->assertOk()->assertJsonCount(3, 'data');
        $this->getJson("/api/v1/me/sponsorships/{$id}")->assertOk()->assertJsonPath('proximoVencimento', '2026-01-31');
        $this->assertDatabaseCount('sponsorship_installments', 3);
        $this->assertDatabaseCount('financial_transactions', 0);
    }

    public function test_creation_checks_roles_fields_eligibility_and_active_duplicate(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong);
        $payload = ['animalId' => $animal->id, 'modalidade' => 'UNICO', 'valor' => '30.00'];
        $this->postJson('/api/v1/sponsorships', $payload)->assertUnauthorized();
        $this->actingAs($this->user('administrador', $ong->id))->postJson('/api/v1/sponsorships', $payload)->assertForbidden();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($this->user('usuario', null, false))->postJson('/api/v1/sponsorships', $payload)->assertUnauthorized();
        $this->actingAs($this->user());
        foreach (['0', '-1.00', '1.234', '10000000000.00'] as $value) {
            $this->postJson('/api/v1/sponsorships', [...$payload, 'valor' => $value])->assertStatus(400);
        }
        $this->postJson('/api/v1/sponsorships', [...$payload, 'modalidade' => 'ANUAL'])->assertStatus(400);
        foreach (['ong_id', 'usuario_id', 'status', 'confirmado_por'] as $field) {
            $this->postJson('/api/v1/sponsorships', [...$payload, $field => 999])->assertStatus(400);
        }
        foreach ([
            ['publicado' => false], ['situacao' => 'INDISPONIVEL'], ['situacao' => 'ADOTADO'], ['situacao' => 'FALECIDO'],
        ] as $changes) {
            $animal->update($changes);
            $this->postJson('/api/v1/sponsorships', $payload)->assertConflict();
            $animal->update(['publicado' => true, 'situacao' => 'DISPONIVEL']);
        }
        $ong->update(['status' => 'SUSPENSA']);
        $this->postJson('/api/v1/sponsorships', $payload)->assertConflict();
        $ong->update(['status' => 'ATIVA']);
        $animal->update(['situacao' => 'EM_PROCESSO_ADOCAO']);
        $this->postJson('/api/v1/sponsorships', $payload)->assertCreated();
        $this->postJson('/api/v1/sponsorships', $payload)->assertConflict();
        $this->postJson('/api/v1/sponsorships', [...$payload, 'modalidade' => 'MENSAL'])->assertCreated();
        $this->assertDatabaseCount('sponsorships', 2);
    }

    public function test_owner_sees_only_own_records_and_cancellation_keeps_due_installments(): void
    {
        $this->travelTo(now()->setDate(2026, 1, 31));
        $animal = $this->animal($this->ong());
        $owner = $this->user();
        $other = $this->user();
        $own = $this->sponsorship($animal, $owner, 'MENSAL');
        $foreign = $this->sponsorship($animal, $other);

        $this->actingAs($owner)->getJson('/api/v1/me/sponsorships?status=ATIVO')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $own->id)->assertJsonMissingPath('data.0.padrinho');
        $this->getJson("/api/v1/me/sponsorships/{$foreign->id}")->assertNotFound();
        $this->getJson("/api/v1/me/sponsorships/{$foreign->id}/parcelas")->assertNotFound();
        $this->patchJson("/api/v1/me/sponsorships/{$foreign->id}/cancelar")->assertNotFound();

        $this->travelTo(now()->setDate(2026, 3, 1));
        $this->patchJson("/api/v1/me/sponsorships/{$own->id}/cancelar")->assertOk()
            ->assertJsonPath('status', 'ENCERRADO')->assertJsonPath('motivoEncerramento', 'CANCELAMENTO_USUARIO');
        $this->patchJson("/api/v1/me/sponsorships/{$own->id}/cancelar")->assertConflict();
        $this->assertSame(3, $own->parcelas()->count());
        $this->travelTo(now()->setDate(2026, 5, 1));
        $this->getJson("/api/v1/me/sponsorships/{$own->id}/parcelas")->assertOk()->assertJsonCount(3, 'data');
        $this->postJson('/api/v1/sponsorships', [
            'animalId' => $animal->id, 'modalidade' => 'MENSAL', 'valor' => '12.34',
        ])->assertCreated();
        $this->assertDatabaseCount('financial_transactions', 0);
    }

    public function test_institutional_list_is_paginated_filtered_and_isolated(): void
    {
        $ong = $this->ong();
        $otherOng = $this->ong();
        $sponsor = $this->user();
        $first = null;
        for ($i = 0; $i < 16; $i++) {
            $record = $this->sponsorship($this->animal($ong, ['nome' => 'Animal '.$i]), $sponsor);
            $first ??= $record;
        }
        $external = $this->sponsorship($this->animal($otherOng), $sponsor);
        $this->actingAs($this->user('voluntario', $ong->id));
        $this->getJson('/api/v1/ong/sponsorships?modalidade=UNICO&status=ATIVO')->assertOk()
            ->assertJsonCount(15, 'data')->assertJsonPath('meta.total', 16)
            ->assertJsonPath('data.0.padrinho.id', $sponsor->id);
        $this->getJson('/api/v1/ong/sponsorships?page=2')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("/api/v1/ong/sponsorships?animalId={$first->animal_id}")->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $first->id);
        $this->getJson("/api/v1/ong/sponsorships/{$first->id}/parcelas")->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("/api/v1/ong/sponsorships/{$external->id}")->assertNotFound();
        $this->getJson("/api/v1/ong/sponsorships/{$external->id}/parcelas")->assertNotFound();
        DB::enableQueryLog();
        $this->getJson("/api/v1/ong/sponsorships?animalId={$first->animal_id}")->assertOk();
        $oneRecordQueries = count(DB::getQueryLog());
        DB::flushQueryLog();
        $this->getJson('/api/v1/ong/sponsorships')->assertOk()->assertJsonCount(15, 'data');
        $fifteenRecordQueries = count(DB::getQueryLog());
        DB::disableQueryLog();
        $this->assertSame($oneRecordQueries, $fifteenRecordQueries);
        $this->patchJson("/api/v1/ong/sponsorships/{$first->id}/encerrar", ['justificativa' => 'Encerrado'])
            ->assertForbidden();
    }

    public function test_admin_closure_requires_reason_and_preserves_installments(): void
    {
        $this->travelTo(now()->setDate(2026, 1, 31));
        $ong = $this->ong();
        $record = $this->sponsorship($this->animal($ong), $this->user(), 'MENSAL');
        $url = "/api/v1/ong/sponsorships/{$record->id}/encerrar";
        $this->actingAs($this->user('administrador', $ong->id));
        $this->patchJson($url, [])->assertStatus(400);
        $this->patchJson($url, ['justificativa' => '   '])->assertStatus(400);
        $this->patchJson($url, ['justificativa' => 'Motivo', 'status' => 'ATIVO'])->assertStatus(400);
        $this->travelTo(now()->setDate(2026, 3, 1));
        $this->patchJson($url, ['justificativa' => ' Decisão institucional '])->assertOk()
            ->assertJsonPath('status', 'ENCERRADO')
            ->assertJsonPath('motivoEncerramento', 'ENCERRAMENTO_ONG')
            ->assertJsonPath('justificativaEncerramento', 'Decisão institucional');
        $this->patchJson($url, ['justificativa' => 'Outra'])->assertConflict();
        $this->assertSame(3, $record->parcelas()->count());
        $this->travelTo(now()->setDate(2026, 5, 1));
        $this->getJson("/api/v1/ong/sponsorships/{$record->id}/parcelas")->assertOk()->assertJsonCount(3, 'data');
        $this->assertDatabaseCount('financial_transactions', 0);
    }

    public function test_inactive_suspended_veterinarian_and_creator_cannot_administer(): void
    {
        $ong = $this->ong();
        $record = $this->sponsorship($this->animal($ong), $this->user());
        foreach (['veterinario', 'criador_plataforma', 'usuario'] as $role) {
            $this->actingAs($this->user($role, $role === 'veterinario' ? $ong->id : null))
                ->getJson('/api/v1/ong/sponsorships')->assertForbidden();
            $this->postJson('/api/v1/auth/logout')->assertOk();
        }
        $this->actingAs($this->user('administrador', $ong->id, false))
            ->getJson('/api/v1/ong/sponsorships')->assertUnauthorized();
        $this->actingAs($this->user('administrador', $ong->id));
        $ong->update(['status' => 'SUSPENSA']);
        $this->getJson('/api/v1/ong/sponsorships')->assertForbidden();
        $this->patchJson("/api/v1/ong/sponsorships/{$record->id}/encerrar", ['justificativa' => 'Motivo'])
            ->assertForbidden();
        $this->assertSame('ATIVO', $record->fresh()->status);
    }

    public function test_installment_number_and_due_date_are_unique_in_database(): void
    {
        $record = $this->sponsorship($this->animal($this->ong()), $this->user());
        $this->expectException(UniqueConstraintViolationException::class);
        $record->parcelas()->create([
            'numero' => 1, 'valor' => '12.34', 'vencimento' => today()->toDateString(), 'status' => 'PENDENTE',
        ]);
    }

    public function test_installment_due_date_cannot_be_reused_with_another_number(): void
    {
        $record = $this->sponsorship($this->animal($this->ong()), $this->user());
        $this->expectException(UniqueConstraintViolationException::class);
        $record->parcelas()->create([
            'numero' => 2, 'valor' => '12.34', 'vencimento' => today()->toDateString(), 'status' => 'PENDENTE',
        ]);
    }

    public function test_monthly_installments_paginate_and_filter_without_future_months(): void
    {
        $this->travelTo(now()->setDate(2025, 1, 15));
        $record = $this->sponsorship($this->animal($this->ong()), $this->user(), 'MENSAL');
        $this->actingAs($record->usuario);
        $this->travelTo(now()->setDate(2026, 5, 1));

        $url = "/api/v1/me/sponsorships/{$record->id}/parcelas";
        $this->getJson($url)->assertOk()->assertJsonCount(15, 'data')->assertJsonPath('meta.total', 17);
        $this->getJson($url.'?page=2&status=PENDENTE')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.1.vencimento', '2026-05-15');
        $this->assertSame(17, $record->parcelas()->count());
        $this->assertDatabaseMissing('sponsorship_installments', ['sponsorship_id' => $record->id, 'vencimento' => '2026-06-15']);
        $this->patchJson("/api/v1/me/sponsorships/{$record->id}/parcelas/1/confirmar")->assertNotFound();
        $this->assertDatabaseCount('financial_transactions', 0);
    }

    public function test_other_ong_cannot_close_and_staff_without_permission_cannot_create(): void
    {
        $ong = $this->ong();
        $otherOng = $this->ong();
        $animal = $this->animal($ong);
        $record = $this->sponsorship($animal, $this->user());
        $this->actingAs($this->user('administrador', $otherOng->id))
            ->patchJson("/api/v1/ong/sponsorships/{$record->id}/encerrar", ['justificativa' => 'Outra ONG'])
            ->assertNotFound();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        foreach (['voluntario', 'veterinario', 'criador_plataforma'] as $role) {
            $this->actingAs($this->user($role, $role === 'criador_plataforma' ? null : $ong->id))
                ->postJson('/api/v1/sponsorships', [
                    'animalId' => $animal->id, 'modalidade' => 'UNICO', 'valor' => '10.00',
                ])->assertForbidden();
            $this->postJson('/api/v1/auth/logout')->assertOk();
        }
        $this->assertSame('ATIVO', $record->fresh()->status);
    }
}
