<?php

namespace Tests\Feature;

use App\Models\ExpenseCategory;
use App\Models\FinancialTransaction;
use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ExpenseAnalysisTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/ong/relatorios/financeiro/analise-despesas';

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://127.0.0.1:5174');
    }

    private function user(string $role = 'administrador', ?Ong $ong = null, bool $active = true): Usuario
    {
        return Usuario::create(['nome' => 'Teste', 'email' => uniqid().'@example.test', 'perfil' => $role, 'ong_id' => $ong?->id, 'ativo' => $active, 'senha_hash' => Hash::make('Oito123!')]);
    }

    private function ong(): Ong
    {
        return Ong::create(['nome' => 'Teste F121', 'email' => uniqid().'@example.test', 'status' => 'ATIVA']);
    }

    private function expense(Ong $ong, string $status, string $value, ?int $category = null, string $date = '2026-03-10'): void
    {
        FinancialTransaction::create(['ong_id' => $ong->id, 'tipo' => 'DESPESA', 'categoria' => 'ALIMENTACAO', 'categoria_id' => $category, 'descricao' => 'F121 teste', 'valor' => $value, 'status' => $status, 'created_at' => '2025-01-01', 'confirmado_em' => $date.' 12:00:00', 'aprovado_em' => $date.' 12:00:00']);
    }

    public function test_totals_categories_dates_and_continuous_months(): void
    {
        $ong = $this->ong();
        $global = ExpenseCategory::where('codigo', 'ALIMENTACAO')->firstOrFail();
        $custom = ExpenseCategory::create(['nome' => 'Resgate', 'nome_chave' => 'resgate', 'escopo' => 'ONG:'.$ong->id, 'ong_id' => $ong->id, 'ativo' => false]);
        $this->expense($ong, 'REALIZADA', '10.10', $global->id);
        $this->expense($ong, 'REALIZADA', '0.20', $global->id);
        $this->expense($ong, 'REALIZADA', '3.33', $custom->id);
        $this->expense($ong, 'REALIZADA', '2.22');
        $this->expense($ong, 'APROVADA', '40.10');
        $this->expense($ong, 'CANCELADA', '999.00');
        $this->expense($ong, 'PENDENTE', '7.25');
        DB::table('financial_transactions')->where('status', 'PENDENTE')->update(['created_at' => '2026-01-05 10:00:00']);
        $this->expense($ong, 'REALIZADA', '888.00', null, '2026-04-01');
        $this->expense($this->ong(), 'REALIZADA', '777.00', $global->id);
        $this->actingAs($this->user('administrador', $ong));
        $r = $this->getJson(self::URL.'?de=2026-01-01&ate=2026-03-31')->assertOk()
            ->assertJsonPath('indicadores.totalPago', '15.85')
            ->assertJsonPath('indicadores.totalAprovado', '40.10')
            ->assertJsonPath('indicadores.totalPendente', '7.25')
            ->assertJsonPath('indicadores.quantidadeDespesas', 6)
            ->assertJsonPath('indicadores.totalPagoSemCategoria', '2.22')
            ->assertJsonPath('categorias.0.categoriaId', $global->id)
            ->assertJsonPath('categorias.0.totalPago', '10.30')
            ->assertJsonPath('categorias.1.ativo', false)
            ->assertJsonPath('categorias.2.nome', 'Não categorizado')
            ->assertJsonCount(3, 'meses')
            ->assertJsonPath('meses.0.competencia', '2026-01')
            ->assertJsonPath('meses.0.totalPendente', '7.25')
            ->assertJsonPath('meses.1.competencia', '2026-02')
            ->assertJsonPath('meses.1.totalPago', '0.00')
            ->assertJsonPath('meses.2.totalPago', '15.85');
        $this->assertCount(3, $r->json('categorias'));
    }

    public function test_access_requires_active_admin_and_active_ong(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $ong = $this->ong();
        foreach (['voluntario', 'veterinario', 'usuario', 'criador_plataforma'] as $role) {
            $this->actingAs($this->user($role, in_array($role, ['voluntario', 'veterinario']) ? $ong : null))->getJson(self::URL)->assertForbidden();
            $this->postJson('/api/v1/auth/logout')->assertOk();
        }
        $this->actingAs($this->user('administrador', $ong, false))->getJson(self::URL)->assertUnauthorized();
        $this->actingAs($this->user('administrador', $ong));
        $ong->update(['status' => 'SUSPENSA']);
        $this->getJson(self::URL)->assertForbidden();
    }

    public function test_default_period_validation_and_empty_response(): void
    {
        $this->travelTo(now()->setDate(2026, 11, 18));
        $this->actingAs($this->user('administrador', $this->ong()));
        $this->getJson(self::URL)->assertOk()->assertJsonPath('periodo.de', '2026-01-01')->assertJsonPath('periodo.ate', '2026-11-18')
            ->assertJsonCount(11, 'meses')->assertJsonPath('indicadores.totalPago', '0.00')->assertJsonPath('indicadores.categoriaMaiorGasto', null);
        foreach (['de=bad', 'de=2026-12-01&ate=2026-01-01', 'de=2020-01-01&ate=2026-01-01', 'ong_id=1'] as $query) {
            $this->getJson(self::URL.'?'.$query)->assertStatus(400);
        }
        $this->travelBack();
    }

    public function test_aggregation_queries_do_not_grow_with_number_of_records(): void
    {
        $ong = $this->ong();
        $this->actingAs($this->user('administrador', $ong));
        $this->expense($ong, 'REALIZADA', '1.00');
        DB::enableQueryLog();
        $this->getJson(self::URL.'?de=2026-01-01&ate=2026-12-31')->assertOk();
        $count = count(DB::getQueryLog());
        DB::disableQueryLog();
        for ($i = 0; $i < 14; $i++) {
            $this->expense($ong, 'REALIZADA', '1.00');
        }
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->getJson(self::URL.'?de=2026-01-01&ate=2026-12-31')->assertOk()->assertJsonPath('indicadores.totalPago', '15.00');
        $this->assertSame($count, count(DB::getQueryLog()));
        DB::disableQueryLog();
    }

    public function test_outros_remains_distinct_from_legacy_and_dates_include_last_day(): void
    {
        $ong = $this->ong();
        $other = ExpenseCategory::where('codigo', 'OUTROS')->firstOrFail();
        $this->expense($ong, 'REALIZADA', '9999999999.99', $other->id, '2026-01-31');
        $this->expense($ong, 'REALIZADA', '0.01', $other->id, '2026-01-31');
        $this->expense($ong, 'REALIZADA', '2.00', null, '2026-01-31');
        $this->expense($ong, 'REALIZADA', '9.00', null, '2026-02-01');
        DB::table('financial_transactions')->where('categoria_id', $other->id)->update(['confirmado_em' => '2026-01-31 23:59:59']);
        $this->actingAs($this->user('administrador', $ong))->getJson(self::URL.'?de=2026-01-31&ate=2026-01-31')
            ->assertOk()->assertJsonPath('indicadores.totalPago', '10000000002.00')
            ->assertJsonPath('categorias.0.nome', 'Outros')->assertJsonPath('categorias.0.totalPago', '10000000000.00')
            ->assertJsonPath('categorias.1.nome', 'Não categorizado')->assertJsonPath('categorias.1.totalPago', '2.00');
    }
}
