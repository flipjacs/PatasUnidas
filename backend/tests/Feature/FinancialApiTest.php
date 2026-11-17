<?php

namespace Tests\Feature;

use App\Models\Donation;
use App\Models\FinancialTransaction;
use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class FinancialApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://127.0.0.1:5174');
    }

    private function ong(string $status = 'ATIVA'): Ong
    {
        return Ong::create(['nome' => 'ONG', 'email' => uniqid().'@example.org', 'status' => $status]);
    }

    private function user(string $role, ?int $ong = null, bool $active = true): Usuario
    {
        return Usuario::create(['nome' => 'Pessoa', 'email' => uniqid().'@example.org', 'senha_hash' => Hash::make('Oito123!'), 'perfil' => $role, 'ong_id' => $ong, 'ativo' => $active]);
    }

    private function payload(string $type = 'RECEITA', string $amount = '25.50'): array
    {
        return ['tipo' => $type, 'categoria' => $type === 'RECEITA' ? 'EVENTO' : 'ALIMENTACAO', 'descricao' => 'Registro de teste', 'valor' => $amount];
    }

    public function test_admin_and_volunteer_create_pending_manual_records(): void
    {
        $ong = $this->ong();
        $admin = $this->user('administrador', $ong->id);
        $this->actingAs($admin)->postJson('/api/v1/ong/finance/movimentacoes', $this->payload())
            ->assertCreated()->assertJsonPath('status', 'PENDENTE')->assertJsonPath('origem.tipo', 'MANUAL');
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $volunteer = $this->user('voluntario', $ong->id);
        $this->actingAs($volunteer)->postJson('/api/v1/ong/finance/movimentacoes', $this->payload('DESPESA'))
            ->assertCreated()->assertJsonPath('registradoPor.id', $volunteer->id);
        $this->assertDatabaseCount('financial_transactions', 2);
        $this->assertDatabaseHas('financial_transactions', ['ong_id' => $ong->id, 'tipo' => 'DESPESA', 'status' => 'PENDENTE', 'origem_id' => null]);
    }

    public function test_invalid_money_category_and_internal_fields_are_rejected(): void
    {
        $ong = $this->ong();
        $this->actingAs($this->user('administrador', $ong->id));
        foreach (['0', '-1', '1.234', '10000000000.00', '1e2'] as $amount) {
            $this->postJson('/api/v1/ong/finance/movimentacoes', $this->payload('RECEITA', $amount))->assertStatus(400);
        }
        $this->postJson('/api/v1/ong/finance/movimentacoes', [...$this->payload(), 'categoria' => 'DOACAO'])->assertStatus(400);
        $this->postJson('/api/v1/ong/finance/movimentacoes', [...$this->payload(), 'origem_tipo' => 'DOACAO', 'origem_id' => 1, 'status' => 'REALIZADA'])->assertStatus(400);
        $this->assertDatabaseCount('financial_transactions', 0);
    }

    public function test_roles_inactive_account_and_suspended_ong_are_blocked(): void
    {
        $ong = $this->ong();
        $url = '/api/v1/ong/finance/movimentacoes';
        $this->postJson($url, $this->payload())->assertUnauthorized();
        foreach (['usuario', 'veterinario', 'criador_plataforma'] as $role) {
            $this->actingAs($this->user($role, $role === 'veterinario' ? $ong->id : null))
                ->postJson($url, $this->payload())->assertForbidden();
            $this->postJson('/api/v1/auth/logout')->assertOk();
        }
        $this->actingAs($this->user('administrador', $ong->id, false))->postJson($url, $this->payload())->assertUnauthorized();
        $this->actingAs($this->user('administrador', $ong->id));
        $ong->update(['status' => 'SUSPENSA']);
        $this->postJson($url, $this->payload())->assertForbidden();
    }

    public function test_expense_requires_approval_before_payment_and_only_realized_affects_balance(): void
    {
        $ong = $this->ong();
        $this->actingAs($this->user('administrador', $ong->id));
        $id = $this->postJson('/api/v1/ong/finance/movimentacoes', $this->payload('DESPESA', '10.25'))->json('id');
        $base = "/api/v1/ong/finance/movimentacoes/$id";
        $this->patchJson("$base/aprovar", ['status' => 'REALIZADA'])->assertStatus(400);
        $this->patchJson("$base/confirmar-pagamento")->assertConflict();
        $this->patchJson("$base/aprovar")->assertOk()->assertJsonPath('status', 'APROVADA');
        $this->getJson('/api/v1/ong/finance/resumo')->assertJsonPath('despesasAprovadas', '10.25')->assertJsonPath('saldoRealizado', '0.00');
        $this->patchJson("$base/confirmar-pagamento")->assertOk()->assertJsonPath('status', 'REALIZADA');
        $this->getJson('/api/v1/ong/finance/resumo')->assertJsonPath('despesasRealizadas', '10.25')->assertJsonPath('saldoRealizado', '-10.25');
        $this->patchJson("$base/confirmar-pagamento")->assertConflict();
        $this->patchJson("$base/cancelar")->assertConflict();
        $this->assertNotNull(FinancialTransaction::findOrFail($id)->aprovado_em);
        $this->assertNotNull(FinancialTransaction::findOrFail($id)->confirmado_em);
    }

    public function test_manual_revenue_only_affects_balance_after_receipt(): void
    {
        $ong = $this->ong();
        $this->actingAs($this->user('administrador', $ong->id));
        $id = $this->postJson('/api/v1/ong/finance/movimentacoes', $this->payload('RECEITA', '100.01'))->json('id');
        $base = "/api/v1/ong/finance/movimentacoes/$id";
        $this->getJson('/api/v1/ong/finance/resumo')->assertJsonPath('receitasPendentes', '100.01')->assertJsonPath('saldoRealizado', '0.00');
        $this->patchJson("$base/aprovar")->assertConflict();
        $this->patchJson("$base/confirmar-recebimento")->assertOk()->assertJsonPath('status', 'REALIZADA');
        $this->getJson('/api/v1/ong/finance/resumo')->assertJsonPath('receitasRealizadas', '100.01')->assertJsonPath('saldoRealizado', '100.01');
        $this->patchJson("$base/confirmar-recebimento")->assertConflict();
    }

    public function test_automatic_donation_revenue_cannot_be_changed_by_manual_endpoints(): void
    {
        $ong = $this->ong();
        $donor = $this->user('usuario');
        $donation = Donation::create(['ong_id' => $ong->id, 'usuario_id' => $donor->id, 'valor' => '30.00', 'status' => 'PENDENTE']);
        $this->actingAs($this->user('administrador', $ong->id))
            ->patchJson("/api/v1/ong/donations/{$donation->id}/confirmar")->assertOk();
        $record = FinancialTransaction::firstOrFail();
        foreach (['aprovar', 'confirmar-recebimento', 'confirmar-pagamento', 'cancelar'] as $action) {
            $this->patchJson("/api/v1/ong/finance/movimentacoes/{$record->id}/$action")->assertConflict();
        }
        $this->patchJson("/api/v1/ong/donations/{$donation->id}/confirmar")->assertConflict();
        $this->assertDatabaseCount('financial_transactions', 1);
        $this->getJson('/api/v1/ong/finance/resumo')->assertJsonPath('receitasRealizadas', '30.00');
    }

    public function test_cancellation_preserves_manual_history_and_volunteer_cannot_decide(): void
    {
        $ong = $this->ong();
        $volunteer = $this->user('voluntario', $ong->id);
        $this->actingAs($volunteer);
        $pending = $this->postJson('/api/v1/ong/finance/movimentacoes', $this->payload())->json('id');
        $this->patchJson("/api/v1/ong/finance/movimentacoes/$pending/confirmar-recebimento")->assertForbidden();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($this->user('administrador', $ong->id));
        $this->patchJson("/api/v1/ong/finance/movimentacoes/$pending/cancelar")->assertJsonPath('status', 'CANCELADA');
        $approved = $this->postJson('/api/v1/ong/finance/movimentacoes', $this->payload('DESPESA'))->json('id');
        $this->patchJson("/api/v1/ong/finance/movimentacoes/$approved/aprovar")->assertOk();
        $this->patchJson("/api/v1/ong/finance/movimentacoes/$approved/cancelar")->assertJsonPath('status', 'CANCELADA');
        $this->assertDatabaseCount('financial_transactions', 2);
        $this->getJson('/api/v1/ong/finance/resumo')->assertJsonPath('saldoRealizado', '0.00');
    }

    public function test_isolation_filters_pagination_and_period_date_semantics(): void
    {
        $ong = $this->ong();
        $other = $this->ong();
        $admin = $this->user('administrador', $ong->id);
        $this->actingAs($admin);
        $id = $this->postJson('/api/v1/ong/finance/movimentacoes', $this->payload('RECEITA', '2.10'))->json('id');
        $external = FinancialTransaction::create(['ong_id' => $other->id, 'tipo' => 'RECEITA', 'categoria' => 'EVENTO', 'descricao' => 'Outra ONG', 'valor' => '900.00', 'status' => 'REALIZADA', 'confirmado_em' => now()]);
        $this->getJson("/api/v1/ong/finance/movimentacoes/{$external->id}")->assertNotFound();
        $this->patchJson("/api/v1/ong/finance/movimentacoes/{$external->id}/cancelar")->assertNotFound();
        $this->getJson('/api/v1/ong/finance/movimentacoes?tipo=RECEITA&status=PENDENTE&categoria=EVENTO')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $id);
        for ($i = 0; $i < 15; $i++) {
            $this->postJson('/api/v1/ong/finance/movimentacoes', $this->payload())->assertCreated();
        }
        $this->getJson('/api/v1/ong/finance/movimentacoes')->assertJsonCount(15, 'data')->assertJsonPath('meta.total', 16);
        $this->getJson('/api/v1/ong/finance/resumo')->assertJsonPath('receitasPendentes', '384.60')->assertJsonPath('receitasRealizadas', '0.00');
        $this->getJson('/api/v1/ong/finance/resumo?de='.now()->addDay()->toDateString())->assertJsonPath('receitasPendentes', '0.00');
        $this->getJson('/api/v1/ong/finance/resumo?ate='.now()->subDay()->toDateString())->assertJsonPath('receitasPendentes', '0.00');
    }

    public function test_summary_distinguishes_creation_approval_and_effective_dates(): void
    {
        $ong = $this->ong();
        $admin = $this->user('administrador', $ong->id);
        $this->actingAs($admin);
        $revenue = $this->postJson('/api/v1/ong/finance/movimentacoes', $this->payload('RECEITA', '10.05'))->json('id');
        $expense = $this->postJson('/api/v1/ong/finance/movimentacoes', $this->payload('DESPESA', '3.02'))->json('id');
        $this->patchJson("/api/v1/ong/finance/movimentacoes/$revenue/confirmar-recebimento")->assertOk();
        $this->patchJson("/api/v1/ong/finance/movimentacoes/$expense/aprovar")->assertOk();
        FinancialTransaction::whereKey($revenue)->update(['created_at' => '2026-01-01 12:00:00', 'confirmado_em' => '2026-11-13 12:00:00']);
        FinancialTransaction::whereKey($expense)->update(['created_at' => '2026-01-01 12:00:00', 'aprovado_em' => '2026-11-13 12:00:00']);
        $this->getJson('/api/v1/ong/finance/resumo?de=2026-11-13&ate=2026-11-13')
            ->assertJsonPath('receitasRealizadas', '10.05')->assertJsonPath('despesasAprovadas', '3.02');
        $this->getJson('/api/v1/ong/finance/movimentacoes?de=2026-11-13&ate=2026-11-13')->assertJsonCount(0, 'data');
    }

    public function test_listing_query_count_is_stable(): void
    {
        $ong = $this->ong();
        $this->actingAs($this->user('administrador', $ong->id));
        $this->postJson('/api/v1/ong/finance/movimentacoes', $this->payload())->assertCreated();
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->getJson('/api/v1/ong/finance/movimentacoes')->assertJsonCount(1, 'data');
        $one = count(DB::getQueryLog());
        for ($i = 0; $i < 14; $i++) {
            $this->postJson('/api/v1/ong/finance/movimentacoes', $this->payload())->assertCreated();
        }
        DB::flushQueryLog();
        $this->getJson('/api/v1/ong/finance/movimentacoes')->assertJsonCount(15, 'data');
        $fifteen = count(DB::getQueryLog());
        DB::disableQueryLog();
        $this->assertSame($one, $fifteen);
    }
}
