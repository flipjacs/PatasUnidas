<?php

namespace Tests\Feature;

use App\Models\FinancialTransaction;
use App\Models\Ong;
use App\Models\TransparencyReport;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class TransparencyReportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://127.0.0.1:5174');
    }

    private function ong(string $status = 'ATIVA'): Ong
    {
        return Ong::create(['nome' => 'ONG F8.2', 'email' => uniqid().'@example.test', 'status' => $status]);
    }

    private function user(string $role = 'administrador', ?Ong $ong = null, bool $active = true): Usuario
    {
        return Usuario::create([
            'nome' => 'Pessoa', 'email' => uniqid().'@example.test',
            'senha_hash' => Hash::make('Oito123!'), 'perfil' => $role,
            'ong_id' => $ong?->id, 'ativo' => $active,
        ]);
    }

    private function payload(?string $start = null, ?string $end = null): array
    {
        return [
            'titulo' => 'Demonstrativo acadêmico', 'descricao' => 'Resumo institucional.',
            'periodoInicio' => $start ?? today()->toDateString(),
            'periodoFim' => $end ?? today()->toDateString(),
        ];
    }

    private function finance(Ong $ong, string $type, string $category, string $value, string $status = 'REALIZADA', ?string $origin = null, ?int $originId = null): FinancialTransaction
    {
        return FinancialTransaction::create([
            'ong_id' => $ong->id, 'tipo' => $type, 'categoria' => $category,
            'descricao' => 'Doador privado: segredo@example.test', 'valor' => $value, 'status' => $status,
            'origem_tipo' => $origin, 'origem_id' => $originId,
            'confirmado_em' => $status === 'REALIZADA' ? now() : null,
            'aprovado_em' => $status === 'APROVADA' ? now() : null,
        ]);
    }

    public function test_draft_is_private_and_period_edit_refreshes_preview_without_client_totals(): void
    {
        $ong = $this->ong();
        $admin = $this->user('administrador', $ong);
        $this->finance($ong, 'RECEITA', 'EVENTO', '10.05');
        $yesterday = today()->subDay()->toDateString();
        $this->actingAs($admin);
        $id = $this->postJson('/api/v1/ong/transparencia', $this->payload($yesterday, $yesterday))
            ->assertCreated()->assertJsonPath('status', 'RASCUNHO')
            ->assertJsonPath('dados.resultadoLiquido', '0.00')->json('id');
        $this->assertDatabaseHas('transparency_reports', ['id' => $id, 'ong_id' => $ong->id, 'status' => 'RASCUNHO']);
        $this->getJson("/api/v1/public/ongs/{$ong->id}/transparencia/{$id}")->assertNotFound();
        $this->getJson("/api/v1/public/ongs/{$ong->id}/transparencia")->assertJsonCount(0, 'data');
        $this->patchJson("/api/v1/ong/transparencia/{$id}", ['titulo' => ' Novo título '])
            ->assertOk()->assertJsonPath('titulo', 'Novo título')->assertJsonPath('dados.resultadoLiquido', '0.00');
        $this->patchJson("/api/v1/ong/transparencia/{$id}", ['periodoInicio' => today()->toDateString(), 'periodoFim' => today()->toDateString()])
            ->assertOk()->assertJsonPath('dados.resultadoLiquido', '10.05');
        $this->postJson('/api/v1/ong/transparencia', [...$this->payload(), 'ong_id' => 999])->assertStatus(400);
        $this->postJson('/api/v1/ong/transparencia', [...$this->payload(), 'dados_consolidados' => ['resultadoLiquido' => '999.99']])->assertStatus(400);
        $this->patchJson("/api/v1/ong/transparencia/{$id}", ['status' => 'PUBLICADO'])->assertStatus(400);
        $this->postJson('/api/v1/ong/transparencia', $this->payload(today()->toDateString(), $yesterday))->assertStatus(400);
        $this->patchJson("/api/v1/ong/transparencia/{$id}", ['periodoFim' => $yesterday])->assertStatus(400);
        $this->assertDatabaseCount('transparency_reports', 1);
    }

    public function test_publication_freezes_aggregates_and_public_resource_excludes_private_data(): void
    {
        $ong = $this->ong();
        $admin = $this->user('administrador', $ong);
        $this->finance($ong, 'RECEITA', 'DOACAO', '25.50', 'REALIZADA', 'DOACAO', 100);
        $this->finance($ong, 'RECEITA', 'APADRINHAMENTO', '35.50', 'REALIZADA', 'APADRINHAMENTO', 200);
        $this->finance($ong, 'DESPESA', 'ALIMENTACAO', '40.10');
        $this->finance($ong, 'RECEITA', 'EVENTO', '100.00', 'PENDENTE');
        $this->finance($ong, 'DESPESA', 'MEDICAMENTOS', '50.00', 'APROVADA');
        $this->finance($this->ong(), 'RECEITA', 'EVENTO', '999.99');
        $this->actingAs($admin);
        $id = $this->postJson('/api/v1/ong/transparencia', $this->payload())->assertCreated()->json('id');
        $url = "/api/v1/ong/transparencia/{$id}";
        $this->patchJson($url.'/publicar')->assertOk()
            ->assertJsonPath('status', 'PUBLICADO')
            ->assertJsonPath('dados.receitasRealizadas', '61.00')
            ->assertJsonPath('dados.despesasRealizadas', '40.10')
            ->assertJsonPath('dados.resultadoLiquido', '20.90')
            ->assertJsonPath('dados.quantidadeMovimentacoes', 3)
            ->assertJsonPath('dados.receitasPorCategoria.DOACAO', '25.50')
            ->assertJsonPath('dados.receitasPorCategoria.APADRINHAMENTO', '35.50');
        $this->assertDatabaseHas('transparency_reports', ['id' => $id, 'status' => 'PUBLICADO', 'publicado_por' => $admin->id]);
        $this->assertNotNull(TransparencyReport::findOrFail($id)->publicado_em);
        $public = $this->getJson("/api/v1/public/ongs/{$ong->id}/transparencia/{$id}")->assertOk()
            ->assertJsonPath('dados.resultadoLiquido', '20.90')
            ->assertJsonMissingPath('publicadoPor')->assertJsonMissingPath('status');
        $this->assertSame(['id', 'ong', 'titulo', 'descricao', 'periodoInicio', 'periodoFim', 'publicadoEm', 'dados'], array_keys($public->json()));
        $this->assertStringNotContainsString('segredo@example.test', $public->getContent());
        $this->assertStringNotContainsString('origem', $public->getContent());
        $report = TransparencyReport::findOrFail($id);
        $report->update(['dados_consolidados' => [...$report->dados_consolidados, 'doadorEmail' => 'privado@example.test']]);
        $this->assertStringNotContainsString('privado@example.test', $this->getJson("/api/v1/public/ongs/{$ong->id}/transparencia/{$id}")->getContent());
        $this->finance($ong, 'RECEITA', 'EVENTO', '10.00');
        $this->getJson("/api/v1/public/ongs/{$ong->id}/transparencia/{$id}")
            ->assertJsonPath('dados.resultadoLiquido', '20.90');
        $this->patchJson($url.'/publicar')->assertConflict();
        $this->patchJson($url, ['titulo' => 'Alterado'])->assertConflict();
        $this->patchJson($url.'/publicar', ['dados' => ['resultadoLiquido' => '999.99']])->assertStatus(400);
    }

    public function test_unpublication_revokes_public_access_and_republication_refreshes_snapshot(): void
    {
        $ong = $this->ong();
        $this->actingAs($this->user('administrador', $ong));
        $this->finance($ong, 'RECEITA', 'EVENTO', '10.00');
        $id = $this->postJson('/api/v1/ong/transparencia', $this->payload())->json('id');
        $url = "/api/v1/ong/transparencia/{$id}";
        $public = "/api/v1/public/ongs/{$ong->id}/transparencia/{$id}";
        $this->patchJson($url.'/publicar')->assertOk();
        $original = TransparencyReport::findOrFail($id)->dados_consolidados;
        $this->patchJson($url.'/despublicar')->assertOk()->assertJsonPath('status', 'RASCUNHO')
            ->assertJsonPath('dados.resultadoLiquido', '10.00');
        $this->getJson($public)->assertNotFound();
        $this->assertSame($original, TransparencyReport::findOrFail($id)->dados_consolidados);
        $this->assertNotNull(TransparencyReport::findOrFail($id)->despublicado_em);
        $this->patchJson($url.'/despublicar')->assertConflict();
        $this->finance($ong, 'DESPESA', 'VETERINARIO', '2.05');
        $this->patchJson($url.'/publicar')->assertOk()->assertJsonPath('dados.resultadoLiquido', '7.95');
        $this->getJson($public)->assertOk()->assertJsonPath('dados.resultadoLiquido', '7.95');
        $this->assertDatabaseCount('transparency_reports', 1);
    }

    public function test_roles_ong_isolation_and_suspension_control_internal_and_public_access(): void
    {
        $ong = $this->ong();
        $other = $this->ong();
        $admin = $this->user('administrador', $ong);
        $this->getJson('/api/v1/ong/transparencia')->assertUnauthorized();
        $this->postJson('/api/v1/ong/transparencia', $this->payload())->assertUnauthorized();
        $this->actingAs($admin);
        $id = $this->postJson('/api/v1/ong/transparencia', $this->payload())->assertCreated()->json('id');
        $this->patchJson("/api/v1/ong/transparencia/{$id}/publicar")->assertOk();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($this->user('voluntario', $ong))
            ->getJson("/api/v1/ong/transparencia/{$id}")->assertOk();
        foreach (['post' => '/api/v1/ong/transparencia', 'patch' => "/api/v1/ong/transparencia/{$id}/despublicar"] as $method => $path) {
            $this->{$method.'Json'}($path, $method === 'post' ? $this->payload() : [])->assertForbidden();
        }
        $this->postJson('/api/v1/auth/logout')->assertOk();
        foreach (['veterinario', 'usuario', 'criador_plataforma'] as $role) {
            $this->actingAs($this->user($role, $role === 'veterinario' ? $ong : null))
                ->getJson('/api/v1/ong/transparencia')->assertForbidden();
            $this->postJson('/api/v1/auth/logout')->assertOk();
        }
        $this->actingAs($this->user('administrador', $other))
            ->getJson("/api/v1/ong/transparencia/{$id}")->assertNotFound();
        $this->patchJson("/api/v1/ong/transparencia/{$id}/despublicar")->assertNotFound();
        $this->getJson("/api/v1/public/ongs/{$other->id}/transparencia/{$id}")->assertNotFound();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($this->user('administrador', $ong, false))
            ->postJson('/api/v1/ong/transparencia', $this->payload())->assertUnauthorized();
        $this->actingAs($admin);
        $ong->update(['status' => 'SUSPENSA']);
        $this->postJson('/api/v1/ong/transparencia', $this->payload())->assertForbidden();
        $this->patchJson("/api/v1/ong/transparencia/{$id}/despublicar")->assertForbidden();
        $this->getJson("/api/v1/public/ongs/{$ong->id}/transparencia/{$id}")->assertNotFound();
        $ong->update(['status' => 'ATIVA']);
        $this->getJson("/api/v1/public/ongs/{$ong->id}/transparencia/{$id}")->assertOk();
    }

    public function test_lists_are_paginated_filtered_and_do_not_recalculate_public_snapshot(): void
    {
        $ong = $this->ong();
        $admin = $this->user('administrador', $ong);
        $this->actingAs($admin);
        $id = $this->postJson('/api/v1/ong/transparencia', $this->payload())->assertCreated()->json('id');
        $this->patchJson("/api/v1/ong/transparencia/{$id}/publicar")->assertOk();
        for ($i = 0; $i < 15; $i++) {
            $next = $this->postJson('/api/v1/ong/transparencia', [...$this->payload(), 'titulo' => 'Relatório '.$i])->assertCreated()->json('id');
            $this->patchJson("/api/v1/ong/transparencia/{$next}/publicar")->assertOk();
        }
        $this->getJson('/api/v1/ong/transparencia?status=PUBLICADO')->assertOk()
            ->assertJsonCount(15, 'data')->assertJsonPath('meta.total', 16);
        $this->getJson('/api/v1/ong/transparencia?page=2')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/public/ongs/'.$ong->id.'/transparencia')->assertOk()
            ->assertJsonCount(15, 'data')->assertJsonPath('meta.total', 16);
        $this->getJson('/api/v1/public/ongs/'.$ong->id.'/transparencia?page=2')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/ong/transparencia?de='.today()->addDay()->toDateString())
            ->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/ong/transparencia?ate='.today()->toDateString())
            ->assertJsonPath('meta.total', 16);
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->getJson('/api/v1/public/ongs/'.$ong->id.'/transparencia?page=2')->assertOk();
        $one = count(DB::getQueryLog());
        $this->assertFalse(collect(DB::getQueryLog())->contains(fn (array $query) => str_contains($query['query'], 'financial_transactions')));
        DB::flushQueryLog();
        $this->getJson('/api/v1/public/ongs/'.$ong->id.'/transparencia')->assertOk();
        $fifteen = count(DB::getQueryLog());
        DB::disableQueryLog();
        $this->assertSame($one, $fifteen);
    }
}
