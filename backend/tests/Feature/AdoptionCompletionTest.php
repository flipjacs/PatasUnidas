<?php

namespace Tests\Feature;

use App\Models\Adoption;
use App\Models\AdoptionRequest;
use App\Models\Animal;
use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdoptionCompletionTest extends TestCase
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

    private function user(string $role, ?int $ongId = null, bool $active = true): Usuario
    {
        return Usuario::create([
            'nome' => 'Pessoa', 'email' => uniqid().'@example.org',
            'senha_hash' => Hash::make('SenhaForte123!'), 'perfil' => $role,
            'ong_id' => $ongId, 'ativo' => $active,
        ]);
    }

    private function animal(int $ongId, array $extra = []): Animal
    {
        return Animal::create([
            'ong_id' => $ongId, 'nome' => 'Thor', 'especie' => 'CACHORRO',
            'sexo' => 'MACHO', 'porte' => 'MEDIO', 'idade_aproximada' => 36,
            'situacao' => 'DISPONIVEL', 'publicado' => true, ...$extra,
        ]);
    }

    private function requestFor(Animal $animal, Usuario $applicant, string $status = 'PENDENTE'): AdoptionRequest
    {
        return AdoptionRequest::create([
            'animal_id' => $animal->id, 'usuario_id' => $applicant->id,
            'ong_id' => $animal->ong_id, 'status' => $status,
        ]);
    }

    public function test_approval_reserves_animal_and_keeps_other_requests_pending(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $first = $this->requestFor($animal, $this->user('usuario'));
        $second = $this->requestFor($animal, $this->user('usuario'));
        $admin = $this->user('administrador', $ong->id);

        $this->actingAs($admin)->patchJson("/api/v1/ong/adoption-requests/{$first->id}/aprovar", ['status' => 'CONCLUIDA'])
            ->assertOk()->assertJsonPath('status', 'APROVADA')->assertJsonPath('analisadoPor.id', $admin->id);
        $this->assertSame('EM_PROCESSO_ADOCAO', $animal->fresh()->situacao);
        $this->assertSame('PENDENTE', $second->fresh()->status);
        $this->assertNotNull($first->fresh()->analisado_em);
        $this->patchJson("/api/v1/ong/adoption-requests/{$second->id}/aprovar")->assertConflict();
        $this->getJson('/api/v1/public/animais')->assertJsonCount(0, 'data');
    }

    public function test_volunteer_can_approve_but_unauthorized_roles_and_suspended_ong_cannot(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $record = $this->requestFor($animal, $this->user('usuario'));
        $url = "/api/v1/ong/adoption-requests/{$record->id}/aprovar";

        foreach (['usuario', 'veterinario', 'criador_plataforma'] as $role) {
            $this->actingAs($this->user($role, $role === 'veterinario' ? $ong->id : null))
                ->patchJson($url)->assertForbidden();
            $this->postJson('/api/v1/auth/logout')->assertOk();
        }
        $this->actingAs($this->user('voluntario', $ong->id))->patchJson($url)->assertOk();

        $other = $this->requestFor($this->animal($ong->id), $this->user('usuario'));
        $ong->update(['status' => 'SUSPENSA']);
        $this->patchJson("/api/v1/ong/adoption-requests/{$other->id}/aprovar")->assertForbidden();
    }

    public function test_external_and_closed_requests_cannot_be_approved(): void
    {
        $ong = $this->ong();
        $otherOng = $this->ong();
        $external = $this->requestFor($this->animal($otherOng->id), $this->user('usuario'));
        $rejected = $this->requestFor($this->animal($ong->id), $this->user('usuario'), 'REJEITADA');
        $cancelled = $this->requestFor($this->animal($ong->id), $this->user('usuario'), 'CANCELADA');

        $this->actingAs($this->user('administrador', $ong->id));
        $this->patchJson("/api/v1/ong/adoption-requests/{$external->id}/aprovar")->assertNotFound();
        $this->patchJson("/api/v1/ong/adoption-requests/{$rejected->id}/aprovar")->assertConflict();
        $this->patchJson("/api/v1/ong/adoption-requests/{$cancelled->id}/aprovar")->assertConflict();
    }

    public function test_approval_rechecks_publication_animal_state_and_active_account(): void
    {
        $ong = $this->ong();
        $unpublished = $this->animal($ong->id, ['publicado' => false]);
        $unavailable = $this->animal($ong->id, ['situacao' => 'INDISPONIVEL']);
        $first = $this->requestFor($unpublished, $this->user('usuario'));
        $second = $this->requestFor($unavailable, $this->user('usuario'));
        $inactive = $this->user('administrador', $ong->id, false);

        $this->actingAs($inactive)->patchJson("/api/v1/ong/adoption-requests/{$first->id}/aprovar")->assertUnauthorized();
        $this->actingAs($this->user('administrador', $ong->id));
        $this->patchJson("/api/v1/ong/adoption-requests/{$first->id}/aprovar")->assertConflict();
        $this->patchJson("/api/v1/ong/adoption-requests/{$second->id}/aprovar")->assertConflict();
        $this->assertDatabaseCount('adoptions', 0);
        $this->assertSame('PENDENTE', $first->fresh()->status);
        $this->assertSame('PENDENTE', $second->fresh()->status);
    }

    public function test_other_ong_cannot_cancel_approval_or_confirm_delivery(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $record = $this->requestFor($animal, $this->user('usuario'));
        $this->actingAs($this->user('administrador', $ong->id))
            ->patchJson("/api/v1/ong/adoption-requests/{$record->id}/aprovar")->assertOk();
        $this->postJson('/api/v1/auth/logout')->assertOk();

        $otherOng = $this->ong();
        $this->actingAs($this->user('administrador', $otherOng->id));
        $this->patchJson("/api/v1/ong/adoption-requests/{$record->id}/cancelar-aprovacao", ['justificativa' => 'Teste'])
            ->assertNotFound();
        $this->postJson("/api/v1/ong/adoption-requests/{$record->id}/confirmar-entrega")->assertNotFound();
        $this->assertSame('APROVADA', $record->fresh()->status);
        $this->assertSame('EM_PROCESSO_ADOCAO', $animal->fresh()->situacao);
    }

    public function test_admin_cancellation_requires_reason_and_releases_reservation(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $first = $this->requestFor($animal, $this->user('usuario'));
        $second = $this->requestFor($animal, $this->user('usuario'));
        $admin = $this->user('administrador', $ong->id);
        $this->actingAs($admin)->patchJson("/api/v1/ong/adoption-requests/{$first->id}/aprovar")->assertOk();

        $url = "/api/v1/ong/adoption-requests/{$first->id}/cancelar-aprovacao";
        $this->patchJson($url, ['justificativa' => ' '])->assertStatus(400);
        $this->patchJson($url, ['justificativa' => 'Mudança de decisão.', 'status' => 'CONCLUIDA'])->assertStatus(400);
        $this->patchJson($url, ['justificativa' => 'Mudança de decisão.'])->assertOk()
            ->assertJsonPath('status', 'CANCELADA')->assertJsonPath('canceladoPor.id', $admin->id);
        $this->assertDatabaseHas('adoption_requests', [
            'id' => $first->id, 'justificativa_cancelamento' => 'Mudança de decisão.',
            'analisado_por' => $admin->id, 'cancelado_por' => $admin->id,
        ]);
        $this->assertNotNull($first->fresh()->cancelado_em);
        $this->assertSame('DISPONIVEL', $animal->fresh()->situacao);
        $this->assertTrue($animal->fresh()->publicado);
        $this->assertSame('PENDENTE', $second->fresh()->status);
        $this->patchJson("/api/v1/ong/adoption-requests/{$second->id}/aprovar")->assertOk();
    }

    public function test_applicant_can_cancel_approved_request_without_releasing_another_reservation(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $applicant = $this->user('usuario');
        $approved = $this->requestFor($animal, $applicant);
        $otherApplicant = $this->user('usuario');
        $pending = $this->requestFor($animal, $otherApplicant);
        $this->actingAs($this->user('voluntario', $ong->id))
            ->patchJson("/api/v1/ong/adoption-requests/{$approved->id}/aprovar")->assertOk();
        $this->postJson('/api/v1/auth/logout')->assertOk();

        $this->actingAs($otherApplicant)->patchJson("/api/v1/me/adoption-requests/{$approved->id}/cancelar")->assertNotFound();
        $this->patchJson("/api/v1/me/adoption-requests/{$pending->id}/cancelar")->assertOk();
        $this->assertSame('EM_PROCESSO_ADOCAO', $animal->fresh()->situacao);
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($applicant)->patchJson("/api/v1/me/adoption-requests/{$approved->id}/cancelar")
            ->assertOk()->assertJsonPath('status', 'CANCELADA');
        $this->assertSame('DISPONIVEL', $animal->fresh()->situacao);
        $this->assertSame($applicant->id, $approved->fresh()->cancelado_por);
        $this->getJson('/api/v1/me/adoption-requests')->assertJsonPath('data.0.status', 'CANCELADA');
    }

    public function test_delivery_completes_adoption_and_closes_only_competing_pending_requests(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $applicant = $this->user('usuario');
        $approved = $this->requestFor($animal, $applicant);
        $competing = $this->requestFor($animal, $this->user('usuario'));
        $previouslyCancelled = $this->requestFor($animal, $this->user('usuario'), 'CANCELADA');
        $previouslyRejected = $this->requestFor($animal, $this->user('usuario'), 'REJEITADA');
        $admin = $this->user('administrador', $ong->id);
        $this->actingAs($admin)->postJson("/api/v1/ong/adoption-requests/{$competing->id}/confirmar-entrega")->assertConflict();
        $this->patchJson("/api/v1/ong/adoption-requests/{$approved->id}/aprovar")->assertOk();

        $this->postJson("/api/v1/ong/adoption-requests/{$approved->id}/confirmar-entrega", ['usuario_id' => $admin->id])
            ->assertOk()->assertJsonPath('status', 'CONCLUIDA')->assertJsonPath('adocao.id', 1);
        $this->assertDatabaseHas('adoptions', [
            'adoption_request_id' => $approved->id, 'animal_id' => $animal->id,
            'usuario_id' => $applicant->id, 'ong_id' => $ong->id, 'confirmado_por' => $admin->id,
        ]);
        $this->assertNotNull(Adoption::firstOrFail()->data_entrega);
        $this->assertSame('CONCLUIDA', $approved->fresh()->status);
        $this->assertSame('ADOTADO', $animal->fresh()->situacao);
        $this->assertDatabaseHas('adoption_requests', [
            'id' => $competing->id, 'status' => 'REJEITADA',
            'justificativa_rejeicao' => 'Animal adotado por outro solicitante.', 'analisado_por' => $admin->id,
        ]);
        $this->assertNotNull($competing->fresh()->analisado_em);
        $this->assertSame('CANCELADA', $previouslyCancelled->fresh()->status);
        $this->assertSame('REJEITADA', $previouslyRejected->fresh()->status);
        $this->assertDatabaseCount('adoptions', 1);
        $this->postJson("/api/v1/ong/adoption-requests/{$approved->id}/confirmar-entrega")->assertConflict();
        $this->patchJson("/api/v1/ong/adoption-requests/{$approved->id}/cancelar-aprovacao", ['justificativa' => 'Teste'])->assertConflict();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($applicant)->patchJson("/api/v1/me/adoption-requests/{$approved->id}/cancelar")->assertConflict();
        $this->getJson('/api/v1/me/adoption-requests')->assertJsonPath('data.0.adocao.id', 1);
        $this->getJson('/api/v1/public/animais')->assertJsonCount(0, 'data');
    }

    public function test_unique_constraints_prevent_duplicate_completed_adoption(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $applicant = $this->user('usuario');
        $first = $this->requestFor($animal, $applicant, 'CONCLUIDA');
        $second = $this->requestFor($animal, $this->user('usuario'), 'APROVADA');
        $admin = $this->user('administrador', $ong->id);
        $base = [
            'animal_id' => $animal->id, 'usuario_id' => $applicant->id,
            'ong_id' => $ong->id, 'confirmado_por' => $admin->id, 'data_entrega' => now(),
        ];
        Adoption::create(['adoption_request_id' => $first->id, ...$base]);

        try {
            Adoption::create(['adoption_request_id' => $second->id, ...$base]);
            $this->fail('A constraint unique de animal_id deveria rejeitar a segunda adoção.');
        } catch (UniqueConstraintViolationException $exception) {
            $this->assertDatabaseCount('adoptions', 1);
        }
    }

    public function test_administrative_listing_query_count_does_not_grow_with_items(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $applicant = $this->user('usuario');
        $this->requestFor($animal, $applicant);
        $this->actingAs($this->user('administrador', $ong->id));

        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->getJson('/api/v1/ong/adoption-requests')->assertOk()->assertJsonCount(1, 'data');
        $oneItemQueries = count(DB::getQueryLog());

        for ($i = 0; $i < 14; $i++) {
            $this->requestFor($animal, $applicant, 'CANCELADA');
        }
        DB::flushQueryLog();
        $this->getJson('/api/v1/ong/adoption-requests')->assertOk()->assertJsonCount(15, 'data');
        $fifteenItemQueries = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertSame($oneItemQueries, $fifteenItemQueries);
    }
}
