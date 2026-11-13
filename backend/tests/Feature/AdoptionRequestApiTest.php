<?php

namespace Tests\Feature;

use App\Models\AdoptionRequest;
use App\Models\Animal;
use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdoptionRequestApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://127.0.0.1:5174');
    }

    private function ong(string $status = 'ATIVA'): Ong
    {
        return Ong::create(['nome' => 'ONG Teste', 'email' => 'ong@example.org', 'status' => $status]);
    }

    private function user(string $role, ?int $ongId = null, bool $active = true): Usuario
    {
        return Usuario::create([
            'nome' => 'Pessoa', 'email' => uniqid().'-'.$role.'@example.org',
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

    public function test_public_user_requests_eligible_animal_without_changing_its_state(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $user = $this->user('usuario');
        $this->actingAs($user)->postJson('/api/v1/adoption-requests', [
            'animalId' => $animal->id, 'mensagem' => 'Quero adotar.',
        ])->assertCreated()->assertJsonPath('status', 'PENDENTE')->assertJsonPath('animal.id', $animal->id);
        $this->assertDatabaseHas('adoption_requests', [
            'animal_id' => $animal->id, 'usuario_id' => $user->id, 'ong_id' => $ong->id, 'status' => 'PENDENTE',
        ]);
        $this->assertSame('DISPONIVEL', $animal->fresh()->situacao);
    }

    public function test_guest_and_employee_cannot_request_adoption(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $this->postJson('/api/v1/adoption-requests', ['animalId' => $animal->id])->assertUnauthorized();
        $this->actingAs($this->user('administrador', $ong->id))
            ->postJson('/api/v1/adoption-requests', ['animalId' => $animal->id])->assertForbidden();
    }

    public function test_ineligible_animals_and_suspended_ong_cannot_receive_requests(): void
    {
        $ong = $this->ong();
        $suspended = $this->ong('SUSPENSA');
        $user = $this->user('usuario');
        $this->actingAs($user);
        foreach ([
            $this->animal($ong->id, ['publicado' => false]),
            $this->animal($ong->id, ['situacao' => 'INDISPONIVEL']),
            $this->animal($ong->id, ['situacao' => 'ADOTADO']),
            $this->animal($ong->id, ['situacao' => 'FALECIDO']),
            $this->animal($ong->id, ['situacao' => 'EM_PROCESSO_ADOCAO']),
            $this->animal($suspended->id),
        ] as $animal) {
            $this->postJson('/api/v1/adoption-requests', ['animalId' => $animal->id])->assertConflict();
        }
        $this->assertDatabaseCount('adoption_requests', 0);
    }

    public function test_multiple_users_can_request_but_same_user_cannot_duplicate_pending(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $first = $this->user('usuario');
        $second = $this->user('usuario');
        $this->actingAs($first)->postJson('/api/v1/adoption-requests', ['animalId' => $animal->id])->assertCreated();
        $this->postJson('/api/v1/adoption-requests', ['animalId' => $animal->id])->assertConflict();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($second)->postJson('/api/v1/adoption-requests', ['animalId' => $animal->id])->assertCreated();
        $this->assertDatabaseCount('adoption_requests', 2);
    }

    public function test_client_cannot_assign_ong_status_or_reviewer(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $this->actingAs($this->user('usuario'))->postJson('/api/v1/adoption-requests', [
            'animalId' => $animal->id, 'ong_id' => 999, 'status' => 'APROVADA', 'analisado_por' => 1,
        ])->assertStatus(400);
        $this->assertDatabaseCount('adoption_requests', 0);
    }

    public function test_user_sees_only_own_requests_and_can_cancel_pending(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $user = $this->user('usuario');
        $other = $this->user('usuario');
        $this->actingAs($user)->postJson('/api/v1/adoption-requests', ['animalId' => $animal->id])->assertCreated();
        $mine = AdoptionRequest::firstOrFail();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($other)->postJson('/api/v1/adoption-requests', ['animalId' => $animal->id])->assertCreated();
        $theirs = AdoptionRequest::orderByDesc('id')->firstOrFail();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($user)->getJson('/api/v1/me/adoption-requests')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $mine->id)->assertJsonMissingPath('data.0.solicitante');
        $this->patchJson("/api/v1/me/adoption-requests/{$theirs->id}/cancelar")->assertNotFound();
        $this->patchJson("/api/v1/me/adoption-requests/{$mine->id}/cancelar")->assertOk()->assertJsonPath('status', 'CANCELADA');
        $this->patchJson("/api/v1/me/adoption-requests/{$mine->id}/cancelar")->assertConflict();
        $this->assertDatabaseHas('adoption_requests', ['id' => $mine->id, 'status' => 'CANCELADA']);
        $this->postJson('/api/v1/adoption-requests', ['animalId' => $animal->id])->assertCreated();
        $this->assertSame('DISPONIVEL', $animal->fresh()->situacao);
    }

    public function test_admin_lists_filters_and_rejects_only_own_ong_requests(): void
    {
        $ong = $this->ong();
        $otherOng = $this->ong();
        $animal = $this->animal($ong->id);
        $externalAnimal = $this->animal($otherOng->id);
        $applicant = $this->user('usuario');
        $mine = AdoptionRequest::create(['animal_id' => $animal->id, 'usuario_id' => $applicant->id, 'ong_id' => $ong->id, 'status' => 'PENDENTE']);
        $external = AdoptionRequest::create(['animal_id' => $externalAnimal->id, 'usuario_id' => $applicant->id, 'ong_id' => $otherOng->id, 'status' => 'PENDENTE']);
        $admin = $this->user('administrador', $ong->id);
        $this->actingAs($admin)->getJson('/api/v1/ong/adoption-requests')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("/api/v1/ong/adoption-requests?status=PENDENTE&animalId={$animal->id}")
            ->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("/api/v1/ong/adoption-requests/{$external->id}")->assertNotFound();
        $this->patchJson("/api/v1/ong/adoption-requests/{$external->id}/rejeitar", ['justificativa' => 'Não aprovado.'])->assertNotFound();
        $this->patchJson("/api/v1/ong/adoption-requests/{$mine->id}/rejeitar", ['justificativa' => 'Não aprovado.'])
            ->assertOk()->assertJsonPath('status', 'REJEITADA')->assertJsonPath('analisadoPor.id', $admin->id);
        $this->assertNotNull($mine->fresh()->analisado_em);
        $this->assertSame('DISPONIVEL', $animal->fresh()->situacao);
        $this->patchJson("/api/v1/ong/adoption-requests/{$mine->id}/rejeitar", ['justificativa' => 'De novo.'])->assertConflict();
    }

    public function test_rejection_requires_reason_and_active_ong(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $user = $this->user('usuario');
        $record = AdoptionRequest::create(['animal_id' => $animal->id, 'usuario_id' => $user->id, 'ong_id' => $ong->id, 'status' => 'PENDENTE']);
        $this->actingAs($this->user('voluntario', $ong->id))
            ->patchJson("/api/v1/ong/adoption-requests/{$record->id}/rejeitar", ['justificativa' => ' '])->assertStatus(400);
        $this->patchJson("/api/v1/ong/adoption-requests/{$record->id}/rejeitar", ['justificativa' => 'Sem condições no momento.'])->assertOk();
        $ong->update(['status' => 'SUSPENSA']);
        $this->getJson('/api/v1/ong/adoption-requests')->assertForbidden();
    }

    public function test_admin_list_is_paginated(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $applicant = $this->user('usuario');
        for ($i = 0; $i < 16; $i++) {
            AdoptionRequest::create(['animal_id' => $animal->id, 'usuario_id' => $applicant->id, 'ong_id' => $ong->id, 'status' => 'CANCELADA']);
        }
        $this->actingAs($this->user('administrador', $ong->id))
            ->getJson('/api/v1/ong/adoption-requests')->assertOk()->assertJsonCount(15, 'data')->assertJsonPath('meta.total', 16);
    }
}
