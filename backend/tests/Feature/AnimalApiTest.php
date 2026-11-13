<?php

namespace Tests\Feature;

use App\Models\Animal;
use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AnimalApiTest extends TestCase
{
    use RefreshDatabase;

    private array $payload = [
        'nome' => 'Thor', 'especie' => 'CACHORRO', 'sexo' => 'MACHO',
        'porte' => 'MEDIO', 'idade_aproximada' => 36, 'descricao' => 'Animal resgatado.',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://127.0.0.1:5174');
    }

    private function ong(string $status = 'ATIVA'): Ong
    {
        return Ong::create(['nome' => 'ONG Teste', 'email' => 'ong@example.org', 'status' => $status]);
    }

    private function usuario(string $perfil, ?int $ongId, bool $ativo = true): Usuario
    {
        return Usuario::create([
            'nome' => 'Pessoa', 'email' => uniqid().'-'.$perfil.'@example.org',
            'senha_hash' => Hash::make('SenhaForte123!'), 'perfil' => $perfil,
            'ong_id' => $ongId, 'ativo' => $ativo,
        ]);
    }

    private function animal(int $ongId, array $fields = []): Animal
    {
        return Animal::create([...$this->payload, ...$fields, 'ong_id' => $ongId, 'situacao' => $fields['situacao'] ?? 'DISPONIVEL']);
    }

    public function test_admin_can_create_animal_for_own_ong_with_available_initial_state(): void
    {
        $ong = $this->ong();
        $this->actingAs($this->usuario('administrador', $ong->id))
            ->postJson('/api/v1/ong/animais', $this->payload)
            ->assertCreated()->assertJsonPath('situacao', 'DISPONIVEL')->assertJsonPath('ongId', $ong->id)
            ->assertJsonPath('idadeAproximada', 36);
        $this->assertDatabaseHas('animal', ['nome' => 'Thor', 'ong_id' => $ong->id, 'situacao' => 'DISPONIVEL']);
    }

    public function test_volunteer_can_create_but_veterinarian_cannot(): void
    {
        $ong = $this->ong();
        $this->actingAs($this->usuario('voluntario', $ong->id))
            ->postJson('/api/v1/ong/animais', $this->payload)->assertCreated();
    }

    public function test_veterinarian_cannot_manage_animals(): void
    {
        $ong = $this->ong();
        $this->actingAs($this->usuario('veterinario', $ong->id))
            ->postJson('/api/v1/ong/animais', $this->payload)->assertForbidden();
    }

    public function test_public_and_creator_cannot_manage_animals(): void
    {
        $this->postJson('/api/v1/ong/animais', $this->payload)->assertUnauthorized();
        $this->actingAs($this->usuario('usuario', null))
            ->postJson('/api/v1/ong/animais', $this->payload)->assertForbidden();
    }

    public function test_creator_cannot_manage_animals(): void
    {
        $this->actingAs($this->usuario('criador_plataforma', null))
            ->postJson('/api/v1/ong/animais', $this->payload)->assertForbidden();
    }

    public function test_suspended_ong_and_inactive_account_cannot_create(): void
    {
        $ong = $this->ong('SUSPENSA');
        $this->actingAs($this->usuario('administrador', $ong->id))
            ->postJson('/api/v1/ong/animais', $this->payload)->assertForbidden();
    }

    public function test_inactive_user_cannot_create(): void
    {
        $ong = $this->ong();
        $this->actingAs($this->usuario('administrador', $ong->id, false))
            ->postJson('/api/v1/ong/animais', $this->payload)->assertUnauthorized();
    }

    public function test_internal_fields_and_invalid_data_are_rejected(): void
    {
        $ong = $this->ong();
        $this->actingAs($this->usuario('administrador', $ong->id))
            ->postJson('/api/v1/ong/animais', [...$this->payload, 'ong_id' => 999, 'situacao' => 'ADOTADO'])
            ->assertStatus(400);
        $this->postJson('/api/v1/ong/animais', [...$this->payload, 'idade_aproximada' => -1])
            ->assertStatus(400);
        $this->assertDatabaseCount('animal', 0);
    }

    public function test_list_filters_paginates_and_does_not_expose_other_ong(): void
    {
        $ong = $this->ong();
        $other = $this->ong();
        $admin = $this->usuario('administrador', $ong->id);
        for ($i = 0; $i < 16; $i++) {
            $this->animal($ong->id, ['nome' => 'Animal '.$i, 'especie' => $i === 0 ? 'GATO' : 'CACHORRO']);
        }
        $external = $this->animal($other->id, ['nome' => 'Externo']);
        $this->actingAs($admin)->getJson('/api/v1/ong/animais')->assertOk()
            ->assertJsonCount(15, 'data')->assertJsonPath('meta.total', 16);
        $this->getJson('/api/v1/ong/animais?especie=GATO&situacao=DISPONIVEL&sexo=MACHO&porte=MEDIO')
            ->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("/api/v1/ong/animais/{$external->id}")->assertNotFound();
        $this->patchJson("/api/v1/ong/animais/{$external->id}", ['nome' => 'Invadido'])->assertNotFound();
        $this->assertSame('Externo', $external->fresh()->nome);
    }

    public function test_update_only_allowed_fields_and_preserves_ong_and_state(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $this->actingAs($this->usuario('administrador', $ong->id))
            ->patchJson("/api/v1/ong/animais/{$animal->id}", ['nome' => 'Thor II'])->assertOk()->assertJsonPath('nome', 'Thor II');
        $this->patchJson("/api/v1/ong/animais/{$animal->id}", ['ong_id' => 999])->assertStatus(400);
        $this->patchJson("/api/v1/ong/animais/{$animal->id}", ['situacao' => 'ADOTADO'])->assertStatus(400);
        $this->assertDatabaseHas('animal', ['id' => $animal->id, 'ong_id' => $ong->id, 'situacao' => 'DISPONIVEL']);
    }

    public function test_only_administrative_state_transitions_are_allowed(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $this->actingAs($this->usuario('voluntario', $ong->id))
            ->patchJson("/api/v1/ong/animais/{$animal->id}/situacao", ['situacao' => 'INDISPONIVEL'])
            ->assertOk()->assertJsonPath('situacao', 'INDISPONIVEL');
        $this->patchJson("/api/v1/ong/animais/{$animal->id}/situacao", ['situacao' => 'DISPONIVEL'])
            ->assertOk()->assertJsonPath('situacao', 'DISPONIVEL');
        $this->patchJson("/api/v1/ong/animais/{$animal->id}/situacao", ['situacao' => 'ADOTADO'])->assertStatus(400);
        $this->patchJson("/api/v1/ong/animais/{$animal->id}/situacao", ['situacao' => 'EM_PROCESSO_ADOCAO'])->assertStatus(400);
        $this->patchJson("/api/v1/ong/animais/{$animal->id}/situacao", ['situacao' => 'FALECIDO'])
            ->assertOk()->assertJsonPath('situacao', 'FALECIDO');
        $this->patchJson("/api/v1/ong/animais/{$animal->id}/situacao", ['situacao' => 'DISPONIVEL'])->assertConflict();
    }

    public function test_adoption_states_cannot_be_changed_administratively(): void
    {
        $ong = $this->ong();
        $adopted = $this->animal($ong->id, ['situacao' => 'ADOTADO']);
        $pending = $this->animal($ong->id, ['situacao' => 'EM_PROCESSO_ADOCAO']);
        $this->actingAs($this->usuario('administrador', $ong->id))
            ->patchJson("/api/v1/ong/animais/{$adopted->id}/situacao", ['situacao' => 'FALECIDO'])->assertConflict();
        $this->patchJson("/api/v1/ong/animais/{$pending->id}/situacao", ['situacao' => 'FALECIDO'])->assertConflict();
    }
}
