<?php

namespace Tests\Feature;

use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PlatformOngApiTest extends TestCase
{
    use RefreshDatabase;

    private array $payload = ['nome' => 'ONG Esperança', 'email' => 'contato@exemplo.org', 'cidade' => 'Manaus', 'estado' => 'AM'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://127.0.0.1:5174');
    }

    private function usuario(string $perfil, bool $ativo = true, ?int $ongId = null): Usuario
    {
        return Usuario::create([
            'nome' => 'Pessoa de Teste', 'email' => $perfil.'@example.org',
            'senha_hash' => Hash::make('SenhaForte123!'), 'perfil' => $perfil,
            'ong_id' => $ongId, 'ativo' => $ativo,
        ]);
    }

    public function test_only_active_creator_can_create_and_list_ongs(): void
    {
        $this->postJson('/api/v1/platform/ongs', $this->payload)->assertUnauthorized();
        $this->getJson('/api/v1/platform/ongs')->assertUnauthorized();

        $creator = $this->usuario('criador_plataforma');
        $this->actingAs($creator)->postJson('/api/v1/platform/ongs', $this->payload)
            ->assertCreated()->assertJsonPath('status', 'SUSPENSA')->assertJsonPath('nome', 'ONG Esperança');
        $this->assertDatabaseHas('ong', ['nome' => 'ONG Esperança', 'status' => 'SUSPENSA']);
        $this->getJson('/api/v1/platform/ongs')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_creator_can_view_update_suspend_and_reactivate_without_losing_ong(): void
    {
        $creator = $this->usuario('criador_plataforma');
        $ong = Ong::create([...$this->payload, 'status' => 'ATIVA']);
        $this->actingAs($creator)->getJson("/api/v1/platform/ongs/{$ong->id}")
            ->assertOk()->assertJsonPath('nome', 'ONG Esperança');
        $this->patchJson("/api/v1/platform/ongs/{$ong->id}", ['nome' => 'ONG Renovada'])
            ->assertOk()->assertJsonPath('nome', 'ONG Renovada');
        $this->patchJson("/api/v1/platform/ongs/{$ong->id}/suspender")
            ->assertOk()->assertJsonPath('status', 'SUSPENSA');
        $this->assertDatabaseHas('ong', ['id' => $ong->id, 'status' => 'SUSPENSA']);
        Usuario::create([
            'nome' => 'Administrador', 'email' => 'admin-ong@example.org',
            'senha_hash' => Hash::make('SenhaForte123!'), 'perfil' => 'administrador',
            'ong_id' => $ong->id, 'ativo' => true,
        ]);
        $this->patchJson("/api/v1/platform/ongs/{$ong->id}/reativar")
            ->assertOk()->assertJsonPath('status', 'ATIVA');
        $this->getJson('/api/v1/platform/ongs/999999')->assertNotFound();
    }

    public function test_invalid_or_administrative_fields_are_rejected(): void
    {
        $creator = $this->usuario('criador_plataforma');
        $this->actingAs($creator)->postJson('/api/v1/platform/ongs', ['nome' => '', 'email' => 'ruim'])
            ->assertStatus(400);
        $this->postJson('/api/v1/platform/ongs', [...$this->payload, 'status' => 'ATIVA'])
            ->assertStatus(400)->assertJsonValidationErrors('status');
        $ong = Ong::create([...$this->payload, 'status' => 'SUSPENSA']);
        $this->patchJson("/api/v1/platform/ongs/{$ong->id}", ['status' => 'ATIVA'])
            ->assertStatus(400);
        $this->assertDatabaseHas('ong', ['id' => $ong->id, 'status' => 'SUSPENSA']);
    }

    private function assertCannotManageOng(string $perfil): void
    {
        $ongId = $perfil === 'usuario' ? null : Ong::create([...$this->payload, 'status' => 'ATIVA'])->id;
        $user = $this->usuario($perfil, true, $ongId);
        $this->actingAs($user)->postJson('/api/v1/platform/ongs', $this->payload)->assertForbidden();
        $this->getJson('/api/v1/platform/ongs')->assertForbidden();
        if ($ongId !== null) {
            $this->patchJson("/api/v1/platform/ongs/{$ongId}", ['nome' => 'Alterada'])->assertForbidden();
            $this->patchJson("/api/v1/platform/ongs/{$ongId}/suspender")->assertForbidden();
        }
    }

    public function test_public_user_cannot_manage_ongs(): void
    {
        $this->assertCannotManageOng('usuario');
    }

    public function test_administrator_cannot_manage_ongs(): void
    {
        $this->assertCannotManageOng('administrador');
    }

    public function test_volunteer_cannot_manage_ongs(): void
    {
        $this->assertCannotManageOng('voluntario');
    }

    public function test_veterinarian_cannot_manage_ongs(): void
    {
        $this->assertCannotManageOng('veterinario');
    }

    public function test_inactive_creator_cannot_manage_ongs(): void
    {
        $creator = $this->usuario('criador_plataforma', false);
        $this->actingAs($creator)->getJson('/api/v1/platform/ongs')->assertUnauthorized();
    }
}
