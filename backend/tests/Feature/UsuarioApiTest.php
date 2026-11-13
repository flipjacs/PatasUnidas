<?php

namespace Tests\Feature;

use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class EnforcedCsrfForTest extends VerifyCsrfToken
{
    protected function runningUnitTests(): bool
    {
        return false;
    }
}

class UsuarioApiTest extends TestCase
{
    use RefreshDatabase;

    private array $cadastro = ['nome' => ' Ana Lima ', 'email' => ' ANA@EXEMPLO.COM ', 'senha' => 'SenhaForte123!'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://127.0.0.1:5174');
    }

    private function ong(string $nome = 'ONG A'): Ong
    {
        return Ong::create(['nome' => $nome, 'email' => 'contato@example.org']);
    }

    private function usuario(string $email = 'admin@example.org', string $perfil = 'administrador', ?int $ongId = null, bool $ativo = true): Usuario
    {
        return Usuario::create(['nome' => 'Pessoa', 'email' => $email, 'senha_hash' => Hash::make('SenhaForte123!'), 'perfil' => $perfil, 'ong_id' => $ongId, 'ativo' => $ativo]);
    }

    public function test_public_registration_normalizes_fields_hashes_password_and_sets_public_role(): void
    {
        $response = $this->postJson('/api/v1/usuarios/cadastro', $this->cadastro);
        $response->assertCreated()->assertExactJson(['id' => 1, 'nome' => 'Ana Lima', 'email' => 'ana@exemplo.com', 'perfil' => 'USUARIO', 'ongId' => null]);
        $user = Usuario::firstOrFail();
        $this->assertSame('usuario', $user->perfil);
        $this->assertNull($user->ong_id);
        $this->assertTrue(Hash::check('SenhaForte123!', $user->senha_hash));
        $this->assertStringStartsWith('$2y$', $user->senha_hash);
    }

    public function test_password_requires_eight_characters_and_stays_hashed(): void
    {
        $this->postJson('/api/v1/usuarios/cadastro', [...$this->cadastro, 'senha' => 'Sete123'])
            ->assertStatus(400)->assertJsonValidationErrors('senha');
        $this->postJson('/api/v1/usuarios/cadastro', [...$this->cadastro, 'senha' => 'Oito123!'])
            ->assertCreated();
        $user = Usuario::where('email', 'ana@exemplo.com')->firstOrFail();
        $this->assertNotSame('Oito123!', $user->senha_hash);
        $this->assertTrue(Hash::check('Oito123!', $user->senha_hash));
    }

    public function test_internal_registration_uses_same_eight_character_minimum(): void
    {
        $ong = $this->ong();
        $this->actingAs($this->usuario('admin-eight@example.org', 'administrador', $ong->id));
        $body = [...$this->cadastro, 'email' => 'funcionario@example.org', 'perfil' => 'VOLUNTARIO'];
        $this->postJson('/api/v1/usuarios/internos', [...$body, 'senha' => 'Sete123'])->assertStatus(400);
        $this->postJson('/api/v1/usuarios/internos', [...$body, 'senha' => 'Oito123!'])->assertCreated();
        $employee = Usuario::where('email', 'funcionario@example.org')->firstOrFail();
        $this->assertTrue(Hash::check('Oito123!', $employee->senha_hash));
    }

    public function test_public_registration_rejects_any_extra_fields(): void
    {
        foreach (['perfil' => 'ADMINISTRADOR', 'tipo' => 'admin', 'ongId' => 1, 'ong_id' => 1, 'ativo' => true] as $field => $value) {
            $this->postJson('/api/v1/usuarios/cadastro', [...$this->cadastro, $field => $value])->assertStatus(400)->assertJsonValidationErrors($field);
        }
        $this->assertDatabaseCount('usuario', 0);
    }

    public function test_duplicate_email_is_a_conflict_even_when_case_differs(): void
    {
        $this->postJson('/api/v1/usuarios/cadastro', $this->cadastro)->assertCreated();
        $this->postJson('/api/v1/usuarios/cadastro', [...$this->cadastro, 'email' => 'ana@exemplo.com'])->assertConflict();
        $this->assertDatabaseCount('usuario', 1);
    }

    public function test_invalid_fields_and_bcrypt_byte_limit_are_rejected(): void
    {
        foreach ([['nome' => '  '], ['nome' => str_repeat('a', 101)], ['email' => 'invalido'], ['email' => str_repeat('a', 121).'@example.org'], ['senha' => 'curta'], ['senha' => str_repeat('a', 73)], ['senha' => str_repeat('á', 40)], ['senha' => str_repeat(' ', 12)]] as $invalid) {
            $this->postJson('/api/v1/usuarios/cadastro', [...$this->cadastro, ...$invalid])->assertStatus(400);
        }
    }

    public function test_login_me_and_logout_with_a_session(): void
    {
        $this->usuario('ana@example.org', 'usuario');
        $this->postJson('/api/v1/auth/login', ['email' => ' ANA@EXAMPLE.ORG ', 'senha' => 'SenhaForte123!'])->assertOk()->assertJsonPath('perfil', 'USUARIO')->assertJsonMissingPath('senha_hash');
        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('email', 'ana@example.org');
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_wrong_password_and_inactive_user_cannot_login(): void
    {
        $this->usuario('ativo@example.org', 'usuario');
        $this->usuario('inativo@example.org', 'usuario', null, false);
        $this->postJson('/api/v1/auth/login', ['email' => 'ativo@example.org', 'senha' => 'errada'])->assertUnauthorized();
        $this->postJson('/api/v1/auth/login', ['email' => 'inativo@example.org', 'senha' => 'SenhaForte123!'])->assertUnauthorized();
    }

    public function test_disabling_a_user_invalidates_their_next_protected_request(): void
    {
        $user = $this->usuario('user@example.org', 'usuario');
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'senha' => 'SenhaForte123!'])->assertOk();
        $this->getJson('/api/v1/auth/me')->assertOk();
        $user->update(['ativo' => false]);
        auth()->forgetGuards();
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_internal_creation_requires_an_active_administrator_with_an_ong(): void
    {
        $body = [...$this->cadastro, 'perfil' => 'VOLUNTARIO'];
        $this->postJson('/api/v1/usuarios/internos', $body)->assertUnauthorized();
        $public = $this->usuario('public@example.org', 'usuario');
        $this->postJson('/api/v1/auth/login', ['email' => $public->email, 'senha' => 'SenhaForte123!'])->assertOk();
        $this->postJson('/api/v1/usuarios/internos', $body)->assertForbidden();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $adminWithoutOng = $this->usuario('noong@example.org');
        $this->postJson('/api/v1/auth/login', ['email' => $adminWithoutOng->email, 'senha' => 'SenhaForte123!'])->assertOk();
        $this->postJson('/api/v1/usuarios/internos', $body)->assertForbidden();
    }

    public function test_admin_creates_internal_user_only_in_own_ong(): void
    {
        $ongA = $this->ong();
        $ongB = $this->ong('ONG B');
        $admin = $this->usuario('admin@example.org', 'administrador', $ongA->id);
        $this->actingAs($admin)->postJson('/api/v1/usuarios/internos', [...$this->cadastro, 'perfil' => 'VOLUNTARIO', 'ongId' => $ongB->id])->assertStatus(400);
        $this->actingAs($admin)->postJson('/api/v1/usuarios/internos', [...$this->cadastro, 'perfil' => 'USUARIO'])->assertStatus(400);
        $this->actingAs($admin)->postJson('/api/v1/usuarios/internos', [...$this->cadastro, 'perfil' => 'VOLUNTARIO'])->assertCreated()->assertJsonPath('perfil', 'VOLUNTARIO')->assertJsonPath('ongId', $ongA->id);
        $this->assertDatabaseHas('usuario', ['email' => 'ana@exemplo.com', 'ong_id' => $ongA->id, 'perfil' => 'voluntario']);
        $this->assertDatabaseMissing('usuario', ['email' => 'ana@exemplo.com', 'ong_id' => $ongB->id]);
    }

    public function test_login_is_rate_limited_after_five_failed_attempts(): void
    {
        RateLimiter::clear('login:'.hash('sha256', 'limit@example.org|127.0.0.1'));
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/login', ['email' => 'limit@example.org', 'senha' => 'incorreta'])->assertUnauthorized();
        }
        $this->postJson('/api/v1/auth/login', ['email' => 'limit@example.org', 'senha' => 'incorreta'])->assertTooManyRequests()->assertHeader('Retry-After');
    }

    public function test_authenticated_state_changing_request_requires_csrf_token(): void
    {
        config(['sanctum.middleware.validate_csrf_token' => EnforcedCsrfForTest::class]);
        $user = $this->usuario('csrf@example.org', 'usuario');
        $token = str_repeat('a', 40);
        $this->actingAs($user)->withSession(['_token' => $token]);
        $this->postJson('/api/v1/auth/logout')->assertStatus(419);
        $this->withHeader('X-CSRF-TOKEN', $token)->postJson('/api/v1/auth/logout')->assertOk();
    }

    public function test_protected_routes_without_a_stateful_session_return_unauthorized(): void
    {
        $this->withoutHeader('Origin')->get('/api/v1/auth/me')->assertUnauthorized();
        $this->withoutHeader('Origin')->postJson('/api/v1/auth/logout')->assertUnauthorized();
    }

    public function test_administrator_can_create_only_permitted_internal_roles(): void
    {
        $ong = $this->ong();
        $admin = $this->usuario('gestor@example.org', 'administrador', $ong->id);
        $this->actingAs($admin)->postJson('/api/v1/usuarios/internos', [
            'nome' => 'Outro Gestor', 'email' => 'outro-gestor@example.org',
            'senha' => 'SenhaForte123!', 'perfil' => 'ADMINISTRADOR',
        ])->assertStatus(400);
        foreach (['VOLUNTARIO', 'VETERINARIO'] as $perfil) {
            $this->actingAs($admin)->postJson('/api/v1/usuarios/internos', [
                'nome' => 'Pessoa Interna', 'email' => strtolower($perfil).'@example.org',
                'senha' => 'SenhaForte123!', 'perfil' => $perfil,
            ])->assertCreated()->assertJsonPath('perfil', $perfil)->assertJsonPath('ongId', $ong->id);
        }
    }

    public function test_demotion_is_respected_on_the_next_request(): void
    {
        $ong = $this->ong();
        $admin = $this->usuario('demovido@example.org', 'administrador', $ong->id);
        $this->postJson('/api/v1/auth/login', ['email' => $admin->email, 'senha' => 'SenhaForte123!'])->assertOk();
        $admin->update(['perfil' => 'voluntario']);
        auth()->forgetGuards();
        $this->postJson('/api/v1/usuarios/internos', [...$this->cadastro, 'perfil' => 'VOLUNTARIO'])->assertForbidden();
    }

    public function test_creator_is_provisioned_once_and_uses_existing_login(): void
    {
        $this->artisan('patas-unidas:provisionar-criador')
            ->expectsQuestion('Nome do criador', ' Criador Acadêmico ')
            ->expectsQuestion('E-mail do criador', ' CRIADOR@EXEMPLO.COM ')
            ->expectsQuestion('Senha', 'Oito123!')
            ->expectsQuestion('Confirme a senha', 'Oito123!')
            ->assertExitCode(0);

        $criador = Usuario::where('perfil', 'criador_plataforma')->firstOrFail();
        $this->assertSame('Criador Acadêmico', $criador->nome);
        $this->assertSame('criador@exemplo.com', $criador->email);
        $this->assertNull($criador->ong_id);
        $this->assertTrue(Hash::check('Oito123!', $criador->senha_hash));
        $this->postJson('/api/v1/auth/login', ['email' => $criador->email, 'senha' => 'Oito123!'])
            ->assertOk()->assertJsonPath('perfil', 'CRIADOR_PLATAFORMA')->assertJsonPath('ongId', null);
        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('perfil', 'CRIADOR_PLATAFORMA');
        $this->postJson('/api/v1/usuarios/internos', [...$this->cadastro, 'perfil' => 'VOLUNTARIO'])->assertForbidden();
        $this->postJson('/api/v1/auth/logout')->assertOk();

        $criador->update(['ativo' => false]);
        $this->artisan('patas-unidas:provisionar-criador')->assertExitCode(1);
        $this->assertDatabaseCount('usuario', 1);
        $this->postJson('/api/v1/auth/login', ['email' => $criador->email, 'senha' => 'Oito123!'])->assertUnauthorized();
    }

    public function test_public_and_internal_registration_cannot_create_creator(): void
    {
        $this->postJson('/api/v1/usuarios/cadastro', [...$this->cadastro, 'perfil' => 'CRIADOR_PLATAFORMA'])->assertStatus(400);
        $this->postJson('/api/v1/usuarios/cadastro', $this->cadastro)->assertCreated()->assertJsonPath('perfil', 'USUARIO');

        $ong = $this->ong();
        $admin = $this->usuario('admin-criador@example.org', 'administrador', $ong->id);
        $this->actingAs($admin)->postJson('/api/v1/usuarios/internos', [
            'nome' => 'Outro Criador', 'email' => 'outro@example.org',
            'senha' => 'SenhaForte123!', 'perfil' => 'CRIADOR_PLATAFORMA',
        ])->assertStatus(400);
        $this->assertDatabaseMissing('usuario', ['email' => 'outro@example.org']);
    }

    public function test_only_versioned_api_routes_are_available(): void
    {
        $this->postJson('/api/v1/usuarios/cadastro', $this->cadastro)->assertCreated();
        $this->postJson('/api/usuarios/cadastro', $this->cadastro)->assertNotFound();
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->getJson('/api/auth/me')->assertNotFound();
    }

    public function test_volunteer_cannot_register_internal_users(): void
    {
        $ong = $this->ong();
        $user = $this->usuario('voluntario@example.org', 'voluntario', $ong->id);
        $this->actingAs($user)->postJson('/api/v1/usuarios/internos', [
            ...$this->cadastro, 'perfil' => 'VOLUNTARIO',
        ])->assertForbidden();
    }

    public function test_veterinarian_cannot_register_internal_users(): void
    {
        $ong = $this->ong();
        $user = $this->usuario('veterinario@example.org', 'veterinario', $ong->id);
        $this->actingAs($user)->postJson('/api/v1/usuarios/internos', [
            ...$this->cadastro, 'perfil' => 'VOLUNTARIO',
        ])->assertForbidden();
    }
}
