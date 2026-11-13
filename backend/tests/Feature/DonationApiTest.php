<?php

namespace Tests\Feature;

use App\Models\Donation;
use App\Models\FinancialTransaction;
use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Tests\TestCase;

class DonationApiTest extends TestCase
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
            'senha_hash' => Hash::make('Oito123!'), 'perfil' => $role,
            'ong_id' => $ongId, 'ativo' => $active,
        ]);
    }

    private function donation(Ong $ong, ?Usuario $user = null, string $status = 'PENDENTE', string $amount = '25.50'): Donation
    {
        return Donation::create([
            'ong_id' => $ong->id, 'usuario_id' => $user?->id,
            'valor' => $amount, 'status' => $status,
        ]);
    }

    public function test_public_user_registers_pending_donation_with_exact_decimal_value(): void
    {
        $ong = $this->ong();
        $user = $this->user('usuario');
        $this->actingAs($user)->postJson('/api/v1/donations', [
            'ongId' => $ong->id, 'valor' => '1234567890.12', 'mensagem' => 'Para os animais.',
        ])->assertCreated()->assertJsonPath('valor', '1234567890.12')->assertJsonPath('status', 'PENDENTE');
        $this->assertDatabaseHas('donations', [
            'ong_id' => $ong->id, 'usuario_id' => $user->id, 'valor' => '1234567890.12', 'status' => 'PENDENTE',
        ]);
        $this->assertDatabaseCount('financial_transactions', 0);
    }

    public function test_invalid_amounts_extra_fields_and_suspended_ong_are_rejected(): void
    {
        $ong = $this->ong();
        $this->actingAs($this->user('usuario'));
        foreach (['0', '0.00', '-1.00', '1.234', '10000000000.00', '1e2', '1,50'] as $amount) {
            $this->postJson('/api/v1/donations', ['ongId' => $ong->id, 'valor' => $amount])->assertStatus(400);
        }
        $this->postJson('/api/v1/donations', ['ongId' => $ong->id, 'valor' => '10.00', 'status' => 'CONFIRMADA'])
            ->assertStatus(400);
        $this->postJson('/api/v1/donations', ['ongId' => $ong->id, 'valor' => '10.00', 'confirmado_por' => 1])
            ->assertStatus(400);
        $suspended = $this->ong('SUSPENSA');
        $this->postJson('/api/v1/donations', ['ongId' => $suspended->id, 'valor' => '10.00'])->assertConflict();
        $this->assertDatabaseCount('donations', 0);
    }

    public function test_only_active_public_user_can_register_and_see_own_donations(): void
    {
        $ong = $this->ong();
        $url = '/api/v1/donations';
        $this->postJson($url, ['ongId' => $ong->id, 'valor' => '10.00'])->assertUnauthorized();
        foreach (['administrador', 'voluntario', 'veterinario', 'criador_plataforma'] as $role) {
            $this->actingAs($this->user($role, $role === 'criador_plataforma' ? null : $ong->id))
                ->postJson($url, ['ongId' => $ong->id, 'valor' => '10.00'])->assertForbidden();
            $this->postJson('/api/v1/auth/logout')->assertOk();
        }
        $this->actingAs($this->user('usuario', null, false))
            ->postJson($url, ['ongId' => $ong->id, 'valor' => '10.00'])->assertUnauthorized();
        $first = $this->user('usuario');
        $second = $this->user('usuario');
        $own = $this->donation($ong, $first);
        $this->donation($ong, $second);
        $this->actingAs($first)->getJson('/api/v1/me/donations')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $own->id)->assertJsonMissingPath('data.0.doador');
    }

    public function test_admin_and_volunteer_read_only_own_ong_with_filters_and_pagination(): void
    {
        $ong = $this->ong();
        $other = $this->ong();
        $own = $this->donation($ong, $this->user('usuario'));
        $external = $this->donation($other, $this->user('usuario'));
        $this->actingAs($this->user('voluntario', $ong->id));
        $this->getJson('/api/v1/ong/donations?status=PENDENTE&de=2026-01-01&ate=2026-12-31')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $own->id);
        $this->getJson("/api/v1/ong/donations/{$external->id}")->assertNotFound();
        $this->patchJson("/api/v1/ong/donations/{$own->id}/confirmar")->assertForbidden();
        $this->patchJson("/api/v1/ong/donations/{$own->id}/cancelar")->assertForbidden();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($this->user('administrador', $ong->id));
        for ($i = 0; $i < 15; $i++) {
            $this->donation($ong);
        }
        $this->getJson('/api/v1/ong/donations')->assertOk()->assertJsonCount(15, 'data')->assertJsonPath('meta.total', 16);
        $this->getJson("/api/v1/ong/donations/{$external->id}")->assertNotFound();
    }

    public function test_other_roles_inactive_accounts_and_suspended_ong_cannot_administer(): void
    {
        $ong = $this->ong();
        $donation = $this->donation($ong);
        foreach (['usuario', 'veterinario', 'criador_plataforma'] as $role) {
            $this->actingAs($this->user($role, $role === 'veterinario' ? $ong->id : null))
                ->getJson('/api/v1/ong/donations')->assertForbidden();
            $this->postJson('/api/v1/auth/logout')->assertOk();
        }
        $this->actingAs($this->user('administrador', $ong->id, false))
            ->patchJson("/api/v1/ong/donations/{$donation->id}/confirmar")->assertUnauthorized();
        $this->actingAs($this->user('administrador', $ong->id));
        $ong->update(['status' => 'SUSPENSA']);
        $this->patchJson("/api/v1/ong/donations/{$donation->id}/confirmar")->assertForbidden();
        $this->assertSame('PENDENTE', $donation->fresh()->status);
    }

    public function test_confirmation_creates_one_realized_revenue_and_cannot_be_repeated(): void
    {
        $ong = $this->ong();
        $donor = $this->user('usuario');
        $donation = $this->donation($ong, $donor, 'PENDENTE', '29.99');
        $admin = $this->user('administrador', $ong->id);
        $this->actingAs($admin)->patchJson("/api/v1/ong/donations/{$donation->id}/confirmar", [
            'valor' => '999.00', 'status' => 'CANCELADA', 'ong_id' => 999,
        ])->assertOk()->assertJsonPath('status', 'CONFIRMADA')->assertJsonPath('valor', '29.99');
        $this->assertDatabaseHas('financial_transactions', [
            'ong_id' => $ong->id, 'tipo' => 'RECEITA', 'categoria' => 'DOACAO',
            'valor' => '29.99', 'status' => 'REALIZADA',
            'origem_tipo' => 'DOACAO', 'origem_id' => $donation->id,
            'confirmado_por' => $admin->id,
        ]);
        $this->assertSame($admin->id, $donation->fresh()->confirmado_por);
        $this->assertNotNull($donation->fresh()->confirmado_em);
        $this->assertNotNull(FinancialTransaction::firstOrFail()->confirmado_em);
        $this->patchJson("/api/v1/ong/donations/{$donation->id}/confirmar")->assertConflict();
        $this->patchJson("/api/v1/ong/donations/{$donation->id}/cancelar")->assertConflict();
        $this->assertDatabaseCount('financial_transactions', 1);
    }

    public function test_cancellation_preserves_donation_without_financial_revenue(): void
    {
        $ong = $this->ong();
        $donation = $this->donation($ong);
        $admin = $this->user('administrador', $ong->id);
        $this->actingAs($admin)
            ->patchJson("/api/v1/ong/donations/{$donation->id}/cancelar")->assertOk()->assertJsonPath('status', 'CANCELADA');
        $this->assertNotNull($donation->fresh()->cancelado_em);
        $this->assertSame($admin->id, $donation->fresh()->cancelado_por);
        $this->patchJson("/api/v1/ong/donations/{$donation->id}/confirmar")->assertConflict();
        $this->assertDatabaseCount('donations', 1);
        $this->assertDatabaseCount('financial_transactions', 0);
    }

    public function test_admin_cannot_confirm_external_donation(): void
    {
        $ong = $this->ong();
        $other = $this->ong();
        $donation = $this->donation($other);
        $this->actingAs($this->user('administrador', $ong->id));
        $this->patchJson("/api/v1/ong/donations/{$donation->id}/confirmar")->assertNotFound();
        $this->patchJson("/api/v1/ong/donations/{$donation->id}/cancelar")->assertNotFound();
    }

    public function test_financial_origin_uniqueness_allows_independent_manual_records(): void
    {
        $ong = $this->ong();
        $donation = $this->donation($ong);
        $base = [
            'ong_id' => $ong->id, 'tipo' => 'RECEITA', 'categoria' => 'DOACAO',
            'descricao' => 'Doação recebida', 'valor' => '25.50', 'status' => 'REALIZADA',
            'origem_tipo' => 'DOACAO', 'origem_id' => $donation->id,
        ];
        FinancialTransaction::create($base);
        try {
            FinancialTransaction::create($base);
            $this->fail('A origem financeira duplicada deveria ser rejeitada.');
        } catch (UniqueConstraintViolationException $exception) {
            $this->assertDatabaseCount('financial_transactions', 1);
        }
        FinancialTransaction::create([...$base, 'origem_tipo' => null, 'origem_id' => null]);
        FinancialTransaction::create([...$base, 'origem_tipo' => null, 'origem_id' => null]);
        $this->assertDatabaseCount('financial_transactions', 3);
    }

    public function test_listing_query_count_does_not_grow_with_records(): void
    {
        $ong = $this->ong();
        $this->donation($ong, $this->user('usuario'));
        $this->actingAs($this->user('administrador', $ong->id));
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->getJson('/api/v1/ong/donations')->assertOk()->assertJsonCount(1, 'data');
        $one = count(DB::getQueryLog());
        for ($i = 0; $i < 14; $i++) {
            $this->donation($ong, $this->user('usuario'));
        }
        DB::flushQueryLog();
        $this->getJson('/api/v1/ong/donations')->assertOk()->assertJsonCount(15, 'data');
        $fifteen = count(DB::getQueryLog());
        DB::disableQueryLog();
        $this->assertSame($one, $fifteen);
    }

    public function test_financial_write_failure_rolls_back_donation_confirmation(): void
    {
        $ong = $this->ong();
        $donation = $this->donation($ong);
        $this->actingAs($this->user('administrador', $ong->id));
        FinancialTransaction::creating(function (): void {
            throw new RuntimeException('Falha simulada na gravação financeira.');
        });

        try {
            $this->withoutExceptionHandling()
                ->patchJson("/api/v1/ong/donations/{$donation->id}/confirmar");
            $this->fail('A falha na gravação financeira deveria interromper a confirmação.');
        } catch (RuntimeException $exception) {
            $this->assertSame('PENDENTE', $donation->fresh()->status);
            $this->assertNull($donation->fresh()->confirmado_em);
            $this->assertDatabaseCount('financial_transactions', 0);
        } finally {
            FinancialTransaction::flushEventListeners();
        }
    }
}
