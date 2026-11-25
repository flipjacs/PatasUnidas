<?php

namespace Tests\Feature;

use App\Models\FinancialTransaction;
use App\Models\InventoryMovement;
use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class InventoryFinancialLinkTest extends TestCase
{
    use RefreshDatabase;

    private const STOCK = '/api/v1/ong/estoque';

    private const FIN = '/api/v1/ong/finance/movimentacoes';

    private Usuario $admin;

    private int $product;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://127.0.0.1:5174');
        $this->travelTo(now()->setDate(2026, 11, 19));
        $ong = Ong::create(['nome' => 'F151', 'email' => 'f151@test.test', 'status' => 'ATIVA']);
        $this->admin = Usuario::create(['nome' => 'Admin', 'email' => 'f151-admin@test.test', 'perfil' => 'administrador', 'ong_id' => $ong->id, 'ativo' => true, 'senha_hash' => Hash::make('Oito123!')]);
        $this->actingAs($this->admin);
        $this->product = $this->postJson(self::STOCK.'/produtos', ['nome' => 'F151 Ração', 'categoriaId' => 1, 'unidadeId' => 2])->assertCreated()->json('id');
    }

    private function expense(string $type = 'DESPESA'): int
    {
        return $this->postJson(self::FIN, ['tipo' => $type, 'categoria' => $type === 'DESPESA' ? 'OUTRA_DESPESA' : 'OUTRA_RECEITA', 'descricao' => 'F151 compra de suprimentos', 'valor' => '300.00'])->assertCreated()->json('id');
    }

    private function entry(array $extra = []): TestResponse
    {
        return $this->postJson(self::STOCK.'/entradas', ['produtoId' => $this->product, 'tipo' => 'ENTRADA_COMPRA', 'quantidade' => '2.000', 'motivo' => 'F151 conferência', 'chaveOperacao' => (string) Str::uuid(), ...$extra]);
    }

    public function test_multiple_partial_receipts_link_to_one_unpaid_expense_without_changing_finance(): void
    {
        $expense = $this->expense();
        $before = (array) DB::table('financial_transactions')->find($expense);
        $first = $this->entry(['despesaId' => $expense, 'lote' => ['codigo' => 'F151-LOTE']])->assertCreated()->assertJsonPath('despesa.id', $expense)->assertJsonPath('despesa.status', 'PENDENTE')->json('id');
        $this->travel(1)->days();
        $second = $this->entry(['despesaId' => $expense, 'quantidade' => '3'])->assertCreated()->assertJsonPath('saldoPosterior', '5.000')->json('id');
        $thirdProduct = $this->postJson(self::STOCK.'/produtos', ['nome' => 'F151 Shampoo', 'categoriaId' => 4, 'unidadeId' => 8])->assertCreated()->json('id');
        $this->entry(['despesaId' => $expense, 'produtoId' => $thirdProduct, 'quantidade' => '1'])->assertCreated();
        $this->assertNotEquals($first, $second);
        $this->assertSame($before, (array) DB::table('financial_transactions')->find($expense));
        $this->getJson(self::STOCK.'/movimentacoes?despesaId='.$expense)->assertOk()->assertJsonCount(3, 'data');
        $this->assertSame(3, FinancialTransaction::find($expense)->entradasEstoque()->count());
    }

    public function test_pending_approved_paid_expenses_are_eligible_and_later_cancel_preserves_link(): void
    {
        $expense = $this->expense();
        $this->entry(['despesaId' => $expense])->assertCreated();
        $this->patchJson(self::FIN.'/'.$expense.'/aprovar')->assertOk();
        $this->entry(['despesaId' => $expense])->assertCreated()->assertJsonPath('despesa.status', 'APROVADA');
        $this->patchJson(self::FIN.'/'.$expense.'/confirmar-pagamento')->assertOk();
        $this->entry(['despesaId' => $expense])->assertCreated()->assertJsonPath('despesa.status', 'REALIZADA');
        $cancel = $this->expense();
        $key = (string) Str::uuid();
        $id = $this->entry(['despesaId' => $cancel, 'chaveOperacao' => $key])->assertCreated()->json('id');
        $this->patchJson(self::FIN.'/'.$cancel.'/cancelar')->assertOk();
        $this->getJson(self::STOCK.'/movimentacoes/'.$id)->assertJsonPath('despesa.status', 'CANCELADA');
        $this->entry(['despesaId' => $cancel, 'chaveOperacao' => $key])->assertOk()->assertJsonPath('id', $id);
        $this->entry(['despesaId' => $cancel])->assertConflict();
    }

    public function test_invalid_financial_origins_and_foreign_expenses_cannot_change_stock(): void
    {
        $income = $this->expense('RECEITA');
        $this->entry(['despesaId' => $income])->assertConflict();
        $cancel = $this->expense();
        $this->patchJson(self::FIN.'/'.$cancel.'/cancelar')->assertOk();
        $this->entry(['despesaId' => $cancel])->assertConflict();
        $other = Ong::create(['nome' => 'B', 'email' => 'b@test.test', 'status' => 'ATIVA']);
        $external = FinancialTransaction::create(['ong_id' => $other->id, 'tipo' => 'DESPESA', 'categoria' => 'OUTRA_DESPESA', 'descricao' => 'Externa', 'valor' => '10.00', 'status' => 'PENDENTE']);
        $this->entry(['despesaId' => $external->id])->assertNotFound();
        $this->entry(['despesaId' => 999999])->assertNotFound();
        $this->entry(['despesaId' => 'abc'])->assertStatus(400);
        $expense = $this->expense();
        FinancialTransaction::find($expense)->update(['origem_tipo' => 'DOACAO', 'origem_id' => 123]);
        $this->entry(['despesaId' => $expense])->assertConflict();
        $this->entry(['tipo' => 'ENTRADA_DOACAO', 'despesaId' => $expense])->assertStatus(400);
        foreach (['saidas' => 'SAIDA_CONSUMO', 'ajustes' => 'AJUSTE_POSITIVO'] as $path => $type) {
            $this->postJson(self::STOCK.'/'.$path, ['produtoId' => $this->product, 'tipo' => $type, 'quantidade' => '1', 'motivo' => 'F151 teste', 'chaveOperacao' => (string) Str::uuid(), 'despesaId' => $expense])->assertStatus(400);
        }
        $this->assertDatabaseCount('inventory_movements', 0);
        $this->assertDatabaseHas('inventory_products', ['id' => $this->product, 'quantidade_disponivel' => 0]);
    }

    public function test_idempotency_compares_financial_link_and_material_donation_has_no_financial_side_effect(): void
    {
        $expense = $this->expense();
        $other = $this->expense();
        $key = (string) Str::uuid();
        $id = $this->entry(['despesaId' => $expense, 'chaveOperacao' => $key])->assertCreated()->json('id');
        $this->entry(['despesaId' => $expense, 'chaveOperacao' => $key])->assertOk()->assertJsonPath('id', $id);
        $this->entry(['despesaId' => $other, 'chaveOperacao' => $key])->assertConflict();
        $this->entry(['chaveOperacao' => $key])->assertConflict();
        $this->entry(['tipo' => 'ENTRADA_DOACAO', 'observacoes' => 'Recebido anonimamente em campanha local.'])->assertCreated()->assertJsonPath('despesa', null);
        $this->assertDatabaseCount('financial_transactions', 2);
        $this->assertDatabaseCount('inventory_movements', 2);
        $this->assertDatabaseHas('inventory_products', ['id' => $this->product, 'quantidade_disponivel' => 4]);
        $this->patchJson(self::STOCK.'/movimentacoes/'.$id, ['despesaId' => $other])->assertMethodNotAllowed();
    }

    public function test_expense_selection_is_reduced_scoped_and_read_permissions_are_preserved(): void
    {
        $expense = $this->expense();
        $this->expense('RECEITA');
        $c = $this->expense();
        $this->patchJson(self::FIN.'/'.$c.'/cancelar')->assertOk();
        for ($i = 0; $i < 15; $i++) {
            $this->expense();
        }
        $this->admin->update(['perfil' => 'voluntario']);
        $data = $this->getJson(self::FIN.'?vinculavelEstoque=1')->assertOk()->assertJsonCount(15, 'data')->assertJsonPath('meta.total', 16)->json('data.0');
        $this->assertSame(['id', 'descricao', 'valor', 'status', 'categoriaDespesa', 'createdAt'], array_keys($data));
        $this->getJson(self::FIN.'?vinculavelEstoque=1&page=2')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 16);
        $this->getJson(self::FIN)->assertOk()->assertJsonStructure(['data' => [['origem', 'registradoPor']]]);
        $id = $this->entry(['despesaId' => $expense])->assertCreated()->json('id');
        $this->getJson('/api/v1/ong/relatorios/financeiro')->assertForbidden();
        $this->admin->update(['perfil' => 'veterinario']);
        $this->getJson(self::FIN.'?vinculavelEstoque=1')->assertForbidden();
        $link = $this->getJson(self::STOCK.'/movimentacoes/'.$id)->assertOk()->json('despesa');
        $this->assertSame(['id' => $expense], $link);
        $this->entry(['despesaId' => $expense])->assertForbidden();
        $this->admin->update(['perfil' => 'administrador']);
        $other = Ong::create(['nome' => 'B', 'email' => 'other@test.test', 'status' => 'ATIVA']);
        $this->admin->update(['ong_id' => $other->id]);
        $this->getJson(self::FIN.'?vinculavelEstoque=1')->assertJsonCount(0, 'data');
        $this->getJson(self::STOCK.'/movimentacoes/'.$id)->assertNotFound();
        $this->getJson(self::STOCK.'/movimentacoes?despesaId='.$expense)->assertNotFound();
        foreach (['usuario', 'criador_plataforma'] as $role) {
            $this->admin->update(['perfil' => $role, 'ong_id' => null]);
            $this->getJson(self::FIN.'?vinculavelEstoque=1')->assertForbidden();
            $this->entry(['despesaId' => $expense])->assertForbidden();
        }
    }

    public function test_legacy_retry_remains_valid_and_database_rejects_cross_institution_link(): void
    {
        $key = 'f1510000-0000-4000-8000-000000000001';
        InventoryMovement::forceCreate(['ong_id' => $this->admin->ong_id, 'produto_id' => $this->product, 'unidade_id' => 2, 'registrado_por' => $this->admin->id, 'tipo' => 'ENTRADA_COMPRA', 'quantidade' => '2.000', 'saldo_anterior' => '0.000', 'saldo_posterior' => '2.000', 'motivo' => 'F151 conferência', 'chave_operacao' => $key, 'conteudo_hash' => 'a0ecad2ba8cc4fe1d1a3a7aabed6a9cb1c20488d1ff066a9482298e0818a511b', 'created_at' => now()]);
        DB::table('inventory_products')->where('id', $this->product)->update(['quantidade_disponivel' => '2.000', 'unidade_fixada_em' => now()]);
        $this->entry(['chaveOperacao' => $key, 'despesaId' => null])->assertOk()->assertJsonPath('despesa', null);
        $expense = $this->expense();
        $other = Ong::create(['nome' => 'B', 'email' => 'foreign@test.test', 'status' => 'ATIVA']);
        try {
            DB::table('inventory_movements')->where('chave_operacao', $key)->update(['ong_id' => $other->id, 'despesa_id' => $expense]);
            $this->fail('O vínculo cruzado deveria violar a FK composta.');
        } catch (QueryException) {
            $this->assertDatabaseHas('inventory_movements', ['chave_operacao' => $key, 'ong_id' => $this->admin->ong_id, 'despesa_id' => null]);
        }
    }

    public function test_failure_to_persist_link_rolls_back_lot_product_history_and_operation_key(): void
    {
        $expense = $this->expense();
        $other = Ong::create(['nome' => 'B', 'email' => 'rollback@test.test', 'status' => 'ATIVA']);
        $external = FinancialTransaction::create(['ong_id' => $other->id, 'tipo' => 'DESPESA', 'categoria' => 'OUTRA_DESPESA', 'descricao' => 'Externa', 'valor' => '10.00', 'status' => 'PENDENTE']);
        $key = (string) Str::uuid();
        InventoryMovement::creating(function (InventoryMovement $movement) use ($external): void {
            $movement->despesa_id = $external->id;
        });
        try {
            $this->entry(['despesaId' => $expense, 'lote' => ['codigo' => 'F151-ROLLBACK'], 'chaveOperacao' => $key])->assertStatus(500);
        } finally {
            InventoryMovement::flushEventListeners();
        }
        $this->assertDatabaseCount('inventory_movements', 0);
        $this->assertDatabaseCount('inventory_lots', 0);
        $this->assertDatabaseHas('inventory_products', ['id' => $this->product, 'quantidade_disponivel' => 0, 'unidade_fixada_em' => null]);
        $this->entry(['despesaId' => $expense, 'chaveOperacao' => $key])->assertCreated();
    }

    public function test_linked_history_does_not_add_one_permission_query_per_movement(): void
    {
        $expense = $this->expense();
        $this->entry(['despesaId' => $expense])->assertCreated();
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->getJson(self::STOCK.'/movimentacoes')->assertOk();
        $one = count(DB::getQueryLog());
        DB::disableQueryLog();
        for ($i = 0; $i < 14; $i++) {
            $this->entry(['despesaId' => $expense])->assertCreated();
        }
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->getJson(self::STOCK.'/movimentacoes')->assertOk()->assertJsonCount(15, 'data');
        $fifteen = count(DB::getQueryLog());
        DB::disableQueryLog();
        $this->assertSame($one, $fifteen);
    }
}
