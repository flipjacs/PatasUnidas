<?php

namespace Tests\Feature;

use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
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
        $response = $this->postJson('/api/usuarios/cadastro', $this->cadastro);
        $response->assertCreated()->assertExactJson(['id' => 1, 'nome' => 'Ana Lima', 'email' => 'ana@exemplo.com', 'perfil' => 'USUARIO', 'ongId' => null]);
        $user = Usuario::firstOrFail();
        $this->assertSame('usuario', $user->perfil);
        $this->assertNull($user->ong_id);
        $this->assertTrue(Hash::check('SenhaForte123!', $user->senha_hash));
        $this->assertStringStartsWith('$2y$', $user->senha_hash);
    }

    public function test_public_registration_rejects_any_extra_fields(): void
    {
        foreach (['perfil' => 'ADMINISTRADOR', 'tipo' => 'admin', 'ongId' => 1, 'ong_id' => 1, 'ativo' => true] as $field => $value) {
            $this->postJson('/api/usuarios/cadastro', [...$this->cadastro, $field => $value])->assertUnprocessable()->assertJsonValidationErrors($field);
        }
        $this->assertDatabaseCount('usuario', 0);
    }

    public function test_duplicate_email_is_a_conflict_even_when_case_differs(): void
    {
        $this->postJson('/api/usuarios/cadastro', $this->cadastro)->assertCreated();
        $this->postJson('/api/usuarios/cadastro', [...$this->cadastro, 'email' => 'ana@exemplo.com'])->assertConflict();
        $this->assertDatabaseCount('usuario', 1);
    }

    public function test_invalid_fields_and_bcrypt_byte_limit_are_rejected(): void
    {
        foreach ([['nome' => '  '], ['nome' => str_repeat('a', 101)], ['email' => 'invalido'], ['email' => str_repeat('a', 121).'@example.org'], ['senha' => 'curta'], ['senha' => str_repeat('a', 73)], ['senha' => str_repeat('á', 40)], ['senha' => str_repeat(' ', 12)]] as $invalid) {
            $this->postJson('/api/usuarios/cadastro', [...$this->cadastro, ...$invalid])->assertUnprocessable();
        }
    }

    public function test_login_me_and_logout_with_a_session(): void
    {
        $this->usuario('ana@example.org', 'usuario');
        $this->postJson('/api/auth/login', ['email' => ' ANA@EXAMPLE.ORG ', 'senha' => 'SenhaForte123!'])->assertOk()->assertJsonPath('perfil', 'USUARIO')->assertJsonMissingPath('senha_hash');
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('email', 'ana@example.org');
        $this->postJson('/api/auth/logout')->assertOk();
        $this->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_wrong_password_and_inactive_user_cannot_login(): void
    {
        $this->usuario('ativo@example.org', 'usuario');
        $this->usuario('inativo@example.org', 'usuario', null, false);
        $this->postJson('/api/auth/login', ['email' => 'ativo@example.org', 'senha' => 'errada'])->assertUnauthorized();
        $this->postJson('/api/auth/login', ['email' => 'inativo@example.org', 'senha' => 'SenhaForte123!'])->assertUnauthorized();
    }

    public function test_disabling_a_user_invalidates_their_next_protected_request(): void
    {
        $user = $this->usuario('user@example.org', 'usuario');
        $this->postJson('/api/auth/login', ['email' => $user->email, 'senha' => 'SenhaForte123!'])->assertOk();
        $this->getJson('/api/auth/me')->assertOk();
        $user->update(['ativo' => false]);
        auth()->forgetGuards();
        $this->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_internal_creation_requires_an_active_administrator_with_an_ong(): void
    {
        $body = [...$this->cadastro, 'perfil' => 'VOLUNTARIO'];
        $this->postJson('/api/usuarios/internos', $body)->assertUnauthorized();
        $public = $this->usuario('public@example.org', 'usuario');
        $this->postJson('/api/auth/login', ['email' => $public->email, 'senha' => 'SenhaForte123!'])->assertOk();
        $this->postJson('/api/usuarios/internos', $body)->assertForbidden();
        $this->postJson('/api/auth/logout')->assertOk();
        $adminWithoutOng = $this->usuario('noong@example.org');
        $this->postJson('/api/auth/login', ['email' => $adminWithoutOng->email, 'senha' => 'SenhaForte123!'])->assertOk();
        $this->postJson('/api/usuarios/internos', $body)->assertForbidden();
    }

    public function test_admin_creates_internal_user_only_in_own_ong(): void
    {
        $ongA = $this->ong();
        $ongB = $this->ong('ONG B');
        $admin = $this->usuario('admin@example.org', 'administrador', $ongA->id);
        $this->actingAs($admin)->postJson('/api/usuarios/internos', [...$this->cadastro, 'perfil' => 'VOLUNTARIO', 'ongId' => $ongB->id])->assertUnprocessable();
        $this->actingAs($admin)->postJson('/api/usuarios/internos', [...$this->cadastro, 'perfil' => 'USUARIO'])->assertUnprocessable();
        $this->actingAs($admin)->postJson('/api/usuarios/internos', [...$this->cadastro, 'perfil' => 'VOLUNTARIO'])->assertCreated()->assertJsonPath('perfil', 'VOLUNTARIO')->assertJsonPath('ongId', $ongA->id);
        $this->assertDatabaseHas('usuario', ['email' => 'ana@exemplo.com', 'ong_id' => $ongA->id, 'perfil' => 'voluntario']);
        $this->assertDatabaseMissing('usuario', ['email' => 'ana@exemplo.com', 'ong_id' => $ongB->id]);
    }

    public function test_login_is_rate_limited_after_five_failed_attempts(): void
    {
        RateLimiter::clear('login:'.hash('sha256', 'limit@example.org|127.0.0.1'));
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', ['email' => 'limit@example.org', 'senha' => 'incorreta'])->assertUnauthorized();
        }
        $this->postJson('/api/auth/login', ['email' => 'limit@example.org', 'senha' => 'incorreta'])->assertTooManyRequests()->assertHeader('Retry-After');
    }
    public function test_authenticated_state_changing_request_requires_csrf_token(): void
    {
        config(['sanctum.middleware.validate_csrf_token' => EnforcedCsrfForTest::class]);
        $user = $this->usuario('csrf@example.org', 'usuario');
        $token = str_repeat('a', 40);
        $this->actingAs($user)->withSession(['_token' => $token]);
        $this->postJson('/api/auth/logout')->assertStatus(419);
        $this->withHeader('X-CSRF-TOKEN', $token)->postJson('/api/auth/logout')->assertOk();
    }

}
