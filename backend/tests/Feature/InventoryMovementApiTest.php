<?php

namespace Tests\Feature;

use App\Models\InventoryMovement;
use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class InventoryMovementApiTest extends TestCase
{
    use RefreshDatabase;

    private const BASE = '/api/v1/ong/estoque';

    private Usuario $admin;

    private int $product;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://127.0.0.1:5174');
        $ong = Ong::create(['nome' => 'F141', 'email' => 'f141@test.test', 'status' => 'ATIVA']);
        $this->admin = Usuario::create(['nome' => 'Admin', 'email' => 'admin@test.test', 'perfil' => 'administrador', 'ong_id' => $ong->id, 'ativo' => true, 'senha_hash' => Hash::make('Oito123!')]);
        $this->actingAs($this->admin);
        $this->product = $this->postJson(self::BASE.'/produtos', ['nome' => 'Ração F141', 'categoriaId' => 1, 'unidadeId' => 2, 'quantidadeMinima' => '3'])->assertCreated()->json('id');
    }

    private function move(string $path, string $type, string $quantity, array $extra = []): TestResponse
    {
        return $this->postJson(self::BASE.'/'.$path, ['produtoId' => $this->product, 'tipo' => $type, 'quantidade' => $quantity, 'motivo' => 'Conferência física', 'chaveOperacao' => (string) Str::uuid(), ...$extra]);
    }

    public function test_entries_withdrawals_and_idempotency_preserve_history(): void
    {
        $key = (string) Str::uuid();
        $id = $this->move('entradas', 'ENTRADA_COMPRA', '25', ['chaveOperacao' => $key])->assertCreated()->assertJsonPath('saldoAnterior', '0.000')->assertJsonPath('saldoPosterior', '25.000')->assertJsonPath('responsavel.id', $this->admin->id)->json('id');
        $this->move('entradas', 'ENTRADA_COMPRA', '25.000', ['chaveOperacao' => $key])->assertOk()->assertJsonPath('id', $id);
        $this->move('entradas', 'ENTRADA_COMPRA', '26', ['chaveOperacao' => $key])->assertConflict();
        $out = (string) Str::uuid();
        $this->move('saidas', 'SAIDA_CONSUMO', '8.500', ['chaveOperacao' => $out])->assertCreated()->assertJsonPath('saldoPosterior', '16.500');
        $this->move('saidas', 'SAIDA_CONSUMO', '8.5', ['chaveOperacao' => $out])->assertOk();
        $this->move('saidas', 'SAIDA_CONSUMO', '20')->assertConflict();
        $this->assertDatabaseCount('inventory_movements', 2);
        $this->getJson(self::BASE.'/produtos/'.$this->product)->assertJsonPath('quantidadeDisponivel', '16.500');
        $this->patchJson(self::BASE.'/produtos/'.$this->product, ['quantidadeDisponivel' => '9'])->assertStatus(400);
    }

    public function test_lots_expiry_and_unallocated_balance_are_independent(): void
    {
        $this->travelTo(now()->setDate(2026, 11, 19));
        $lot = $this->move('entradas', 'ENTRADA_DOACAO', '12', ['lote' => ['codigo' => 'A', 'validade' => '2026-11-18']])->assertCreated()->json('lote.id');
        $this->move('saidas', 'SAIDA_CONSUMO', '1', ['loteId' => $lot])->assertConflict();
        $this->move('saidas', 'SAIDA_CONSUMO', '1')->assertConflict();
        $this->move('saidas', 'SAIDA_DESCARTE', '2', ['loteId' => $lot])->assertCreated()->assertJsonPath('saldoPosterior', '10.000');
        $this->move('entradas', 'ENTRADA_COMPRA', '3', ['lote' => ['codigo' => 'B', 'validade' => '2026-11-19']])->assertCreated();
        $this->move('saidas', 'SAIDA_CONSUMO', '1', ['loteId' => $lot + 1])->assertCreated();
        $this->move('entradas', 'ENTRADA_COMPRA', '1', ['lote' => ['codigo' => 'A', 'validade' => '2027-01-01']])->assertConflict();
        $this->getJson(self::BASE.'/alertas?tipo=VENCIDO')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson(self::BASE.'/alertas?tipo=PROXIMO_VENCIMENTO')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson(self::BASE.'/produtos/'.$this->product.'/lotes')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_validation_adjustments_permissions_and_tenant_isolation(): void
    {
        foreach (['0', '-1', '1.0001', '1e2'] as $q) {
            $this->move('entradas', 'ENTRADA_COMPRA', $q)->assertStatus(400);
        }
        $this->move('ajustes', 'AJUSTE_POSITIVO', '3', ['motivo' => ''])->assertStatus(400);
        $this->move('ajustes', 'AJUSTE_POSITIVO', '3')->assertCreated();
        $this->move('ajustes', 'AJUSTE_NEGATIVO', '1')->assertCreated();
        $this->getJson(self::BASE.'/alertas?tipo=BAIXO')->assertOk()->assertJsonCount(1, 'data');
        foreach (['ong_id' => 99, 'saldoPosterior' => '99', 'usuario_id' => 1] as $k => $v) {
            $this->move('entradas', 'ENTRADA_COMPRA', '1', [$k => $v])->assertStatus(400);
        }
        $this->admin->update(['perfil' => 'voluntario']);
        $this->move('ajustes', 'AJUSTE_POSITIVO', '1')->assertForbidden();
        $this->move('entradas', 'ENTRADA_DEVOLUCAO', '1')->assertCreated();
        $this->admin->update(['perfil' => 'veterinario']);
        $this->move('entradas', 'ENTRADA_COMPRA', '1')->assertForbidden();
        $this->getJson(self::BASE.'/movimentacoes')->assertOk();
        $this->admin->update(['perfil' => 'administrador']);
        $other = Ong::create(['nome' => 'Other', 'email' => 'other@test.test', 'status' => 'ATIVA']);
        $this->admin->update(['ong_id' => $other->id]);
        $this->move('entradas', 'ENTRADA_COMPRA', '1')->assertNotFound();
        $this->getJson(self::BASE.'/movimentacoes/1')->assertNotFound();
        $this->getJson(self::BASE.'/movimentacoes')->assertJsonCount(0, 'data');
    }

    public function test_precision_inactive_product_lot_ownership_and_unit_history(): void
    {
        $this->patchJson(self::BASE.'/produtos/'.$this->product, ['unidadeId' => 1, 'quantidadeMinima' => '3'])->assertOk();
        $this->move('entradas', 'ENTRADA_COMPRA', '1.5')->assertStatus(400);
        $lot = $this->move('entradas', 'ENTRADA_COMPRA', '3', ['lote' => ['codigo' => 'ONE']])->assertCreated()->json('lote.id');
        $other = $this->postJson(self::BASE.'/produtos', ['nome' => 'Outro', 'categoriaId' => 1, 'unidadeId' => 1])->assertCreated()->json('id');
        $this->move('saidas', 'SAIDA_PERDA', '1', ['produtoId' => $other, 'loteId' => $lot])->assertNotFound();
        $this->move('saidas', 'SAIDA_PERDA', '4', ['loteId' => $lot])->assertConflict();
        $this->move('saidas', 'SAIDA_PERDA', '3', ['loteId' => $lot])->assertCreated();
        $this->patchJson(self::BASE.'/produtos/'.$this->product, ['unidadeId' => 2])->assertConflict();
        $this->getJson(self::BASE.'/alertas?tipo=ESGOTADO')->assertJsonCount(2, 'data');
        $this->patchJson(self::BASE.'/produtos/'.$this->product.'/desativar')->assertOk();
        $this->move('entradas', 'ENTRADA_COMPRA', '1')->assertConflict();
        $this->getJson(self::BASE.'/alertas?tipo=ESGOTADO')->assertJsonCount(1, 'data');
    }

    public function test_history_filters_pagination_and_failed_write_roll_back_balances_and_lots(): void
    {
        for ($i = 0; $i < 16; $i++) {
            $this->move('entradas', 'ENTRADA_COMPRA', '0.100')->assertCreated();
        }
        $this->getJson(self::BASE.'/movimentacoes?produtoId='.$this->product.'&tipo=ENTRADA_COMPRA&de='.now()->toDateString().'&ate='.now()->toDateString())->assertOk()->assertJsonCount(15, 'data')->assertJsonPath('meta.total', 16);
        $this->getJson(self::BASE.'/movimentacoes?page=2')->assertJsonCount(1, 'data');
        $this->getJson(self::BASE.'/movimentacoes?ate='.now()->toDateString())->assertOk();
        $this->getJson(self::BASE.'/movimentacoes?de=2026-12-31&ate=2026-01-01')->assertStatus(400);
        $this->getJson(self::BASE.'/alertas?tipo=VENCIDO&dias=999')->assertStatus(400);
        InventoryMovement::creating(function () {
            throw new \RuntimeException('Falha simulada de persistência');
        });
        try {
            $this->move('entradas', 'ENTRADA_COMPRA', '1', ['lote' => ['codigo' => 'ROLLBACK']])->assertStatus(500);
        } finally {
            InventoryMovement::flushEventListeners();
        }
        $this->assertDatabaseCount('inventory_movements', 16);
        $this->assertDatabaseCount('inventory_lots', 0);
        $this->getJson(self::BASE.'/produtos/'.$this->product)->assertJsonPath('quantidadeDisponivel', '1.600');
    }

    public function test_inactive_accounts_suspended_ongs_and_external_roles_are_denied(): void
    {
        $this->admin->update(['ativo' => false]);
        $this->getJson(self::BASE.'/movimentacoes')->assertUnauthorized();
        $this->admin->update(['ativo' => true]);
        $this->actingAs($this->admin);
        $this->admin->ong->update(['status' => 'SUSPENSA']);
        $this->getJson(self::BASE.'/alertas?tipo=BAIXO')->assertForbidden();
        $this->admin->ong->update(['status' => 'ATIVA']);
        foreach (['usuario', 'criador_plataforma'] as $role) {
            $this->admin->update(['perfil' => $role]);
            $this->getJson(self::BASE.'/movimentacoes')->assertForbidden();
            $this->move('entradas', 'ENTRADA_COMPRA', '1')->assertForbidden();
        }
    }

    public function test_expiry_control_is_explicit_per_product_and_cannot_be_removed_after_movement(): void
    {
        $this->patchJson(self::BASE.'/produtos/'.$this->product, ['controlaValidade' => true])->assertOk();
        $this->move('entradas', 'ENTRADA_COMPRA', '2')->assertStatus(400);
        $this->move('entradas', 'ENTRADA_COMPRA', '2', ['lote' => ['codigo' => 'SEM-DATA']])->assertStatus(400);
        $this->move('entradas', 'ENTRADA_COMPRA', '2', ['lote' => ['codigo' => 'COM-DATA', 'validade' => '2027-01-01']])->assertCreated();
        $this->patchJson(self::BASE.'/produtos/'.$this->product, ['controlaValidade' => false])->assertConflict();
    }
}
