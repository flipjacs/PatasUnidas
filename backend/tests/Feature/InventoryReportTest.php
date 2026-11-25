<?php

namespace Tests\Feature;

use App\Models\InventoryCategory;
use App\Models\InventoryProduct;
use App\Models\InventoryUnit;
use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class InventoryReportTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/ong/estoque/relatorios/';

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(now()->setDate(2026, 11, 19)->setTime(12, 0));
        $this->withHeader('Origin', 'http://127.0.0.1:5174');
    }

    private function institution(): Ong
    {
        return Ong::create(['nome' => 'F161', 'email' => Str::uuid().'@patas.test', 'status' => 'ATIVA']);
    }

    private function employee(Ong $ong, string $role = 'administrador', bool $active = true): Usuario
    {
        return Usuario::create(['nome' => 'F161', 'email' => Str::uuid().'@patas.test', 'perfil' => $role, 'ong_id' => in_array($role, ['usuario', 'criador_plataforma']) ? null : $ong->id, 'ativo' => $active, 'senha_hash' => Hash::make('Demo1234')]);
    }

    private function product(Ong $ong, string $unit = 'KG', string $balance = '1.000', bool $active = true): InventoryProduct
    {
        return InventoryProduct::forceCreate(['ong_id' => $ong->id, 'nome' => 'F161 '.Str::uuid(), 'identidade' => Str::uuid(), 'categoria_id' => InventoryCategory::where('codigo', 'ALIMENTACAO')->value('id'), 'unidade_id' => InventoryUnit::where('codigo', $unit)->value('id'), 'quantidade_disponivel' => $balance, 'quantidade_minima' => '2.000', 'ativo' => $active]);
    }

    private function movement(InventoryProduct $product, Usuario $user, string $type, string $quantity, string $date): void
    {
        DB::table('inventory_movements')->insert(['ong_id' => $product->ong_id, 'produto_id' => $product->id, 'unidade_id' => $product->unidade_id, 'registrado_por' => $user->id, 'tipo' => $type, 'quantidade' => $quantity, 'saldo_anterior' => '100.000', 'saldo_posterior' => '90.000', 'motivo' => 'Fixture histórica', 'chave_operacao' => Str::uuid(), 'conteudo_hash' => str_repeat('a', 64), 'created_at' => $date]);
    }

    public function test_summary_separates_current_stock_history_units_and_months(): void
    {
        $ong = $this->institution();
        $user = $this->employee($ong);
        $kg = $this->product($ong);
        $dose = $this->product($ong, 'DOSE', '10.000', false);
        $this->product($ong, 'CAIXA', '0.000');
        $this->movement($kg, $user, 'SAIDA_CONSUMO', '0.101', '2026-01-01 00:00:00');
        $this->movement($kg, $user, 'SAIDA_CONSUMO', '0.202', '2026-03-31 23:59:59');
        $this->movement($dose, $user, 'SAIDA_CONSUMO', '4.000', '2026-03-01 00:00:00');
        foreach (['ENTRADA_COMPRA', 'ENTRADA_DOACAO', 'ENTRADA_DEVOLUCAO', 'SAIDA_PERDA', 'SAIDA_DESCARTE', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'] as $type) {
            $this->movement($kg, $user, $type, '1.000', '2026-01-05 00:00:00');
        }
        $this->movement($kg, $user, 'SAIDA_CONSUMO', '99.000', '2026-04-01 00:00:00');
        $other = $this->institution();
        $this->movement($this->product($other), $this->employee($other), 'SAIDA_CONSUMO', '88.000', '2026-01-01 00:00:00');
        $this->actingAs($user);
        $response = $this->getJson(self::URL.'resumo?de=2026-01-01&ate=2026-03-31')->assertOk()
            ->assertJsonPath('catalogo.total', 3)->assertJsonPath('catalogo.ativos', 2)->assertJsonPath('catalogo.inativos', 1)
            ->assertJsonPath('catalogo.comSaldo', 1)->assertJsonPath('catalogo.esgotados', 1)->assertJsonPath('catalogo.estoqueBaixo', 1)
            ->assertJsonPath('movimentacoes.totalOperacoes', 10)->assertJsonPath('movimentacoes.produtosDistintos', 2)
            ->assertJsonPath('movimentacoes.entradas', 3)->assertJsonPath('movimentacoes.saidas', 5)->assertJsonPath('movimentacoes.ajustes', 2)
            ->assertJsonCount(2, 'consumoPorCategoria')->assertJsonCount(3, 'meses')
            ->assertJsonPath('meses.1.competencia', '2026-02')->assertJsonPath('meses.1.totalOperacoes', 0)
            ->assertJsonPath('ranking.criterio', 'FREQUENCIA_SAIDAS_CONSUMO')->assertJsonPath('ranking.itens.0.produtoId', $kg->id)
            ->assertJsonPath('ranking.itens.0.quantidadeConsumida', '0.303')->assertJsonPath('ranking.itens.1.quantidadeConsumida', '4.000');
        $this->assertSame(['0.303', '4.000'], array_column($response->json('consumoPorCategoria'), 'quantidadeConsumida'));
        $this->getJson(self::URL.'resumo?de=2020-01-01&ate=2020-01-31')->assertOk()->assertJsonPath('catalogo.total', 3)->assertJsonPath('movimentacoes.totalOperacoes', 0);
    }

    public function test_expiry_counts_lots_distinct_products_and_separates_valid_quantities(): void
    {
        $ong = $this->institution();
        $product = $this->product($ong, 'DOSE', '30.000');
        foreach ([['2026-11-18', '3.000'], ['2026-11-17', '2.000'], ['2026-11-19', '4.000'], ['2026-12-19', '6.000'], ['2026-12-20', '10.000'], [null, '5.000'], ['2026-11-01', '0.000']] as [$date, $quantity]) {
            DB::table('inventory_lots')->insert(['ong_id' => $ong->id, 'produto_id' => $product->id, 'codigo' => Str::uuid(), 'validade' => $date, 'quantidade_disponivel' => $quantity, 'created_at' => now(), 'updated_at' => now()]);
        }
        $this->actingAs($this->employee($ong));
        $this->getJson(self::URL.'resumo')->assertOk()->assertJsonPath('validade.lotesVencidos', 2)
            ->assertJsonPath('validade.produtosComLotesVencidos', 1)->assertJsonPath('validade.lotesProximos', 2)
            ->assertJsonPath('validade.produtosComLotesProximos', 1)
            ->assertJsonPath('validade.quantidadesPorUnidade.0.vencida', '5.000')
            ->assertJsonPath('validade.quantidadesPorUnidade.0.proxima', '10.000')
            ->assertJsonPath('validade.quantidadesPorUnidade.0.validaAposJanela', '10.000')
            ->assertJsonPath('validade.quantidadesPorUnidade.0.semValidade', '5.000');
    }

    public function test_filters_permissions_and_validation_preserve_institutional_scope(): void
    {
        $a = $this->institution();
        $b = $this->institution();
        $own = $this->product($a);
        $foreign = $this->product($b);
        $category = InventoryCategory::forceCreate(['nome' => 'Privada', 'nome_chave' => 'privada', 'escopo' => 'ONG-'.$b->id, 'ong_id' => $b->id, 'ativo' => false]);
        $this->getJson(self::URL.'resumo')->assertUnauthorized();
        foreach (['administrador', 'voluntario', 'veterinario'] as $role) {
            $this->actingAs($this->employee($a, $role));
            $this->getJson(self::URL.'resumo?produtoId='.$own->id)->assertOk()->assertJsonPath('catalogo.total', 1);
            $this->getJson(self::URL.'resumo?produtoId='.$foreign->id)->assertNotFound();
            $this->getJson(self::URL.'resumo?categoriaId='.$category->id)->assertNotFound();
            $this->getJson(self::URL.'produtos-criticos?produtoId='.$foreign->id)->assertNotFound();
            $this->postJson('/api/v1/auth/logout')->assertOk();
        }
        foreach (['usuario', 'criador_plataforma'] as $role) {
            $this->actingAs($this->employee($a, $role));
            $this->getJson(self::URL.'resumo')->assertForbidden();
            $this->postJson('/api/v1/auth/logout')->assertOk();
        }
        $this->actingAs($this->employee($a));
        foreach (['de=errado', 'de=2026-03-01&ate=2026-01-01', 'de=2020-01-01&ate=2026-01-01', 'limiteRanking=21', 'ong_id=2', 'produtoId=-1', 'unidadeId=999999'] as $query) {
            $this->getJson(self::URL.'resumo?'.$query)->assertStatus(400);
        }
        $a->update(['status' => 'SUSPENSA']);
        $this->getJson(self::URL.'resumo')->assertForbidden();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($this->employee($b, active: false));
        $this->getJson(self::URL.'resumo')->assertUnauthorized();
    }

    public function test_critical_products_are_paginated_ordered_and_keep_old_alerts_compatible(): void
    {
        $ong = $this->institution();
        $user = $this->employee($ong);
        $low = $this->product($ong);
        $zero = $this->product($ong, balance: '0.000');
        for ($i = 0; $i < 15; $i++) {
            $this->product($ong);
        }
        $this->product($ong, balance: '0.000', active: false);
        $this->actingAs($user);
        $this->getJson(self::URL.'produtos-criticos')->assertOk()->assertJsonPath('meta.total', 17)
            ->assertJsonCount(15, 'data')->assertJsonPath('data.0.id', $zero->id)->assertJsonPath('data.0.estadoEstoque', 'ESGOTADO')
            ->assertJsonPath('data.1.id', $low->id)->assertJsonPath('data.1.estadoEstoque', 'BAIXO');
        $this->getJson(self::URL.'produtos-criticos?page=2')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/ong/estoque/alertas?tipo=ESGOTADO')->assertOk()->assertJsonPath('meta.total', 1);
    }

    public function test_inactive_custom_category_remains_in_history_and_queries_do_not_grow_per_product(): void
    {
        $ong = $this->institution();
        $user = $this->employee($ong);
        $category = InventoryCategory::forceCreate(['nome' => 'Histórica', 'nome_chave' => 'historica', 'escopo' => 'ONG-'.$ong->id, 'ong_id' => $ong->id, 'ativo' => false]);
        $this->actingAs($user);
        $counts = [];
        foreach ([1, 15] as $size) {
            for ($i = 0; $i < $size; $i++) {
                $p = $this->product($ong, active: false);
                $p->update(['categoria_id' => $category->id]);
                $this->movement($p, $user, 'SAIDA_CONSUMO', '0.001', '2026-11-19 12:00:00');
            }
            DB::enableQueryLog();
            DB::flushQueryLog();
            $this->getJson(self::URL.'resumo?categoriaId='.$category->id.'&limiteRanking=1')->assertOk()
                ->assertJsonPath('consumoPorCategoria.0.categoria.ativo', false)->assertJsonCount(1, 'ranking.itens');
            $queries = DB::getQueryLog();
            $this->assertCount(7, array_filter($queries, fn ($query) => str_contains($query['query'], 'inventory_products" as "p')));
            $counts[] = count($queries);
            DB::disableQueryLog();
        }
        $this->assertSame($counts[0], $counts[1]);
    }
}
