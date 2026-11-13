<?php

namespace Tests\Feature;

use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class FuncionarioApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://127.0.0.1:5174');
    }

    private function ong(string $name = 'ONG A'): Ong
    {
        return Ong::create(['nome' => $name, 'email' => 'contato@example.org', 'status' => 'SUSPENSA']);
    }

    private function usuario(string $perfil, ?int $ongId = null, bool $ativo = true): Usuario
    {
        return Usuario::create([
            'nome' => 'Pessoa', 'email' => uniqid().'-'.$perfil.'@example.org',
            'senha_hash' => Hash::make('SenhaForte123!'), 'perfil' => $perfil,
            'ong_id' => $ongId, 'ativo' => $ativo,
        ]);
    }

    public function test_creator_provisions_first_admin_and_admin_defines_own_password(): void
    {
        $ong = $this->ong();
        $creator = $this->usuario('criador_plataforma');
        $this->actingAs($creator)->postJson("/api/v1/platform/ongs/{$ong->id}/administradores", [
            'nome' => 'Primeira Admin', 'email' => ' ADMIN@EXEMPLO.ORG ',
        ])->assertCreated()->assertJsonPath('perfil', 'ADMINISTRADOR')->assertJsonPath('ongId', $ong->id)->assertJsonMissingPath('senha_hash');
        $admin = Usuario::where('email', 'admin@exemplo.org')->firstOrFail();
        $this->assertFalse($admin->ativo);
        $this->assertStringStartsWith('$2y$', $admin->senha_hash);
        $this->assertSame('SUSPENSA', $ong->fresh()->status);
        $this->patchJson("/api/v1/platform/ongs/{$ong->id}/reativar")->assertConflict();
        $this->postJson("/api/v1/platform/ongs/{$ong->id}/administradores", [
            'nome' => 'Segunda Admin', 'email' => 'segunda@exemplo.org',
        ])->assertConflict();
        $token = Password::broker()->createToken($admin);
        $this->postJson('/api/v1/auth/primeiro-acesso', [
            'email' => $admin->email, 'token' => $token, 'senha' => 'Sete123',
        ])->assertStatus(400);
        $this->postJson('/api/v1/auth/primeiro-acesso', [
            'email' => $admin->email, 'token' => $token, 'senha' => 'Oito123!',
        ])->assertOk();
        $this->assertTrue($admin->fresh()->ativo);
        $this->assertTrue(Hash::check('Oito123!', $admin->fresh()->senha_hash));
        $this->postJson('/api/v1/auth/primeiro-acesso', [
            'email' => $admin->email, 'token' => $token, 'senha' => 'OutraSenhaForte123!',
        ])->assertStatus(400);
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->postJson('/api/v1/auth/login', [
            'email' => $admin->email, 'senha' => 'Oito123!',
        ])->assertOk()->assertJsonPath('perfil', 'ADMINISTRADOR');
        $this->getJson('/api/v1/ong/funcionarios')->assertForbidden();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($creator);
        $this->patchJson("/api/v1/platform/ongs/{$ong->id}/reativar")->assertOk()->assertJsonPath('status', 'ATIVA');
    }

    public function test_only_creator_can_provision_and_admin_cannot_choose_fields(): void
    {
        $ong = $this->ong();
        $body = ['nome' => 'Admin', 'email' => 'admin@example.org'];
        $this->postJson("/api/v1/platform/ongs/{$ong->id}/administradores", $body)->assertUnauthorized();
        $admin = $this->usuario('administrador', $ong->id);
        $this->actingAs($admin)->postJson("/api/v1/platform/ongs/{$ong->id}/administradores", $body)->assertForbidden();
    }

    public function test_creator_cannot_supply_role_ong_or_password(): void
    {
        $ong = $this->ong();
        $creator = $this->usuario('criador_plataforma');
        $this->actingAs($creator)->postJson("/api/v1/platform/ongs/{$ong->id}/administradores", [
            'nome' => 'Admin', 'email' => 'admin@example.org', 'perfil' => 'CRIADOR_PLATAFORMA',
            'ongId' => 999, 'senha' => 'SenhaForte123!', 'ativo' => true,
        ])->assertStatus(400);
        $this->assertDatabaseMissing('usuario', ['email' => 'admin@example.org']);
    }

    private function assertCannotCreateAdministrator(string $perfil): void
    {
        $ong = $this->ong();
        $user = $this->usuario($perfil, $perfil === 'usuario' ? null : $ong->id);
        $this->actingAs($user)->postJson("/api/v1/platform/ongs/{$ong->id}/administradores", [
            'nome' => 'Admin', 'email' => 'admin@example.org',
        ])->assertForbidden();
    }

    public function test_public_user_cannot_create_administrator(): void
    {
        $this->assertCannotCreateAdministrator('usuario');
    }

    public function test_volunteer_cannot_create_administrator(): void
    {
        $this->assertCannotCreateAdministrator('voluntario');
    }

    public function test_veterinarian_cannot_create_administrator(): void
    {
        $this->assertCannotCreateAdministrator('veterinario');
    }

    public function test_admin_manages_only_own_employees_when_ong_active(): void
    {
        $ong = $this->ong();
        $ong->update(['status' => 'ATIVA']);
        $otherOng = $this->ong('ONG B');
        $otherOng->update(['status' => 'ATIVA']);
        $admin = $this->usuario('administrador', $ong->id);
        $employee = $this->usuario('voluntario', $ong->id);
        $other = $this->usuario('veterinario', $otherOng->id);
        $this->actingAs($admin)->getJson('/api/v1/ong/funcionarios')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("/api/v1/ong/funcionarios/{$other->id}")->assertNotFound();
        $this->getJson("/api/v1/ong/funcionarios/{$employee->id}")->assertOk();
        $this->patchJson("/api/v1/ong/funcionarios/{$employee->id}/desativar")->assertOk();
        $this->assertFalse($employee->fresh()->ativo);
        auth()->forgetGuards();
        $this->postJson('/api/v1/auth/login', ['email' => $employee->email, 'senha' => 'SenhaForte123!'])->assertUnauthorized();
        $this->actingAs($admin);
        $this->patchJson("/api/v1/ong/funcionarios/{$employee->id}/ativar")->assertOk();
        $this->assertTrue($employee->fresh()->ativo);
        $ong->update(['status' => 'SUSPENSA']);
        $this->getJson('/api/v1/ong/funcionarios')->assertForbidden();
        $this->postJson('/api/v1/usuarios/internos', [
            'nome' => 'Nova', 'email' => 'nova@example.org', 'senha' => 'SenhaForte123!', 'perfil' => 'VOLUNTARIO',
        ])->assertForbidden();
    }

    public function test_non_admins_cannot_manage_employees(): void
    {
        $ong = $this->ong();
        $ong->update(['status' => 'ATIVA']);
        $creator = $this->usuario('criador_plataforma');
        $this->actingAs($creator)->getJson('/api/v1/ong/funcionarios')->assertForbidden();
    }

    public function test_first_access_rejects_invalid_and_expired_tokens(): void
    {
        $ong = $this->ong();
        $admin = $this->usuario('administrador', $ong->id, false);
        $token = Password::broker()->createToken($admin);
        $this->assertDatabaseHas('password_reset_tokens', ['email' => $admin->email]);
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $admin->email, 'token' => $token]);

        $body = ['email' => $admin->email, 'senha' => 'NovaSenhaForte123!'];
        $this->postJson('/api/v1/auth/primeiro-acesso', [...$body, 'token' => 'invalido'])->assertStatus(400);
        $this->travel(61)->minutes();
        $this->postJson('/api/v1/auth/primeiro-acesso', [...$body, 'token' => $token])->assertStatus(400);
        $this->assertFalse($admin->fresh()->ativo);
    }
}
