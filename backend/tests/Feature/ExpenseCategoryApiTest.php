<?php

namespace Tests\Feature;

use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ExpenseCategoryApiTest extends TestCase
{
    use RefreshDatabase;

    private function ong(): Ong
    {
        return Ong::create(['nome' => 'ONG teste', 'email' => uniqid().'@example.test', 'status' => 'ATIVA']);
    }

    private function user(string $role, Ong $ong): Usuario
    {
        return Usuario::create(['nome' => 'Pessoa', 'email' => uniqid().'@example.test', 'senha_hash' => Hash::make('Oito123!'), 'perfil' => $role, 'ong_id' => $ong->id, 'ativo' => true]);
    }

    public function test_global_and_custom_categories_are_scoped_and_managed(): void
    {
        $a = $this->ong();
        $b = $this->ong();
        $this->actingAs($this->user('administrador', $a));
        $base = '/api/v1/ong/finance/categorias-despesa';
        $this->getJson($base)->assertOk()->assertJsonCount(12, 'data');
        $id = $this->postJson($base, ['nome' => 'Resgate emergencial'])->assertCreated()->assertJsonPath('global', false)->json('id');
        $this->postJson($base, ['nome' => 'resgate emergencial'])->assertConflict();
        $this->patchJson("$base/$id", ['nome' => 'Resgate urgente'])->assertOk();
        $this->postJson($base, ['nome' => 'Intrusa', 'ong_id' => $b->id])->assertStatus(400);
        $this->actingAs($this->user('administrador', $b));
        $this->getJson($base)->assertJsonCount(12, 'data');
        $this->patchJson("$base/$id", ['nome' => 'Outro'])->assertNotFound();
        $this->actingAs($this->user('voluntario', $a));
        $this->getJson($base)->assertJsonCount(13, 'data');
        $this->postJson($base, ['nome' => 'Negada'])->assertForbidden();
        $this->actingAs($this->user('veterinario', $a));
        $this->getJson($base)->assertForbidden();
    }

    public function test_expense_assignment_filter_and_history_after_deactivation(): void
    {
        $ong = $this->ong();
        $this->actingAs($this->user('administrador', $ong));
        $base = '/api/v1/ong/finance';
        $id = $this->postJson("$base/categorias-despesa", ['nome' => 'Resgate emergencial'])->json('id');
        $payload = ['tipo' => 'DESPESA', 'descricao' => 'F111-BACKEND teste', 'valor' => '12.34'];
        $expense = $this->postJson("$base/movimentacoes", [...$payload, 'categoriaId' => $id])->assertCreated()
            ->assertJsonPath('categoriaDespesa.nome', 'Resgate emergencial')->json('id');
        $this->postJson("$base/movimentacoes", [...$payload, 'categoria' => 'ALIMENTACAO'])->assertCreated()
            ->assertJsonPath('categoriaDespesa', null);
        $this->getJson("$base/movimentacoes?categoriaId=$id")->assertJsonCount(1, 'data');
        $this->getJson("$base/movimentacoes?semCategoria=1")->assertJsonCount(1, 'data');
        $this->patchJson("$base/categorias-despesa/$id/desativar")->assertOk()->assertJsonPath('ativo', false);
        $this->getJson("$base/movimentacoes/$expense")->assertJsonPath('categoriaDespesa.nome', 'Resgate emergencial');
        $this->postJson("$base/movimentacoes", [...$payload, 'categoriaId' => $id])->assertStatus(400);
        $this->assertDatabaseHas('financial_transactions', ['id' => $expense, 'status' => 'PENDENTE', 'valor' => '12.34']);
        $this->assertDatabaseHas('expense_categories', ['id' => $id, 'ativo' => false]);
    }

    public function test_other_ong_category_cannot_be_used_or_filtered(): void
    {
        $a = $this->ong();
        $b = $this->ong();
        $this->actingAs($this->user('administrador', $a));
        $id = $this->postJson('/api/v1/ong/finance/categorias-despesa', ['nome' => 'Exclusiva'])->json('id');
        $this->actingAs($this->user('administrador', $b));
        $this->postJson('/api/v1/ong/finance/movimentacoes', ['tipo' => 'DESPESA', 'descricao' => 'Teste', 'valor' => '1.00', 'categoriaId' => $id])->assertStatus(400);
        $this->getJson("/api/v1/ong/finance/movimentacoes?categoriaId=$id")->assertStatus(400);
        $this->assertDatabaseCount('financial_transactions', 0);
    }
}
