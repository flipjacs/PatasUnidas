<?php

namespace Tests\Feature;

use App\Models\Adoption;
use App\Models\AdoptionRequest;
use App\Models\Animal;
use App\Models\Donation;
use App\Models\FinancialTransaction;
use App\Models\MedicalRecord;
use App\Models\Ong;
use App\Models\Sponsorship;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class OngDashboardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://127.0.0.1:5174');
    }

    private function ong(string $status = 'ATIVA'): Ong
    {
        return Ong::create(['nome' => 'ONG Dashboard', 'email' => uniqid().'@example.test', 'status' => $status]);
    }

    private function user(string $role = 'usuario', ?Ong $ong = null, bool $active = true): Usuario
    {
        return Usuario::create([
            'nome' => 'Pessoa', 'email' => uniqid().'@example.test',
            'senha_hash' => Hash::make('Oito123!'), 'perfil' => $role,
            'ong_id' => $ong?->id, 'ativo' => $active,
        ]);
    }

    private function animal(Ong $ong, string $status = 'DISPONIVEL', bool $published = true): Animal
    {
        return Animal::create([
            'ong_id' => $ong->id, 'nome' => 'Animal Dashboard', 'especie' => 'GATO',
            'sexo' => 'FEMEA', 'porte' => 'PEQUENO', 'idade_aproximada' => 12,
            'situacao' => $status, 'publicado' => $published,
        ]);
    }

    private function finance(Ong $ong, string $type, string $category, string $value, string $status = 'REALIZADA', ?string $origin = null, ?int $originId = null): FinancialTransaction
    {
        return FinancialTransaction::create([
            'ong_id' => $ong->id, 'tipo' => $type, 'categoria' => $category,
            'descricao' => 'Teste F8.1', 'valor' => $value, 'status' => $status,
            'origem_tipo' => $origin, 'origem_id' => $originId,
            'confirmado_em' => $status === 'REALIZADA' ? now() : null,
            'aprovado_em' => $status === 'APROVADA' ? now() : null,
        ]);
    }

    public function test_roles_receive_only_authorized_sections_and_inactive_or_suspended_users_are_blocked(): void
    {
        $ong = $this->ong();
        $dashboard = '/api/v1/ong/dashboard';
        $report = '/api/v1/ong/relatorios/financeiro';
        $this->getJson($dashboard)->assertUnauthorized();
        $this->getJson($report)->assertUnauthorized();
        $this->actingAs($this->user('administrador', $ong))->getJson($dashboard)->assertOk()
            ->assertJsonStructure(['animais', 'clinico', 'adocoes', 'apadrinhamentos', 'doacoes', 'financeiro']);
        $this->getJson($report)->assertOk();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($this->user('voluntario', $ong))->getJson($dashboard)->assertOk()
            ->assertJsonStructure(['animais', 'clinico', 'adocoes', 'apadrinhamentos'])
            ->assertJsonMissingPath('doacoes')->assertJsonMissingPath('financeiro');
        $this->getJson($report)->assertForbidden();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($this->user('veterinario', $ong))->getJson($dashboard)->assertOk()
            ->assertJsonStructure(['animais', 'clinico'])
            ->assertJsonMissingPath('adocoes')->assertJsonMissingPath('apadrinhamentos')
            ->assertJsonMissingPath('financeiro');
        $this->getJson($report)->assertForbidden();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        foreach (['usuario', 'criador_plataforma'] as $role) {
            $this->actingAs($this->user($role))->getJson($dashboard)->assertForbidden();
            $this->getJson($report)->assertForbidden();
            $this->postJson('/api/v1/auth/logout')->assertOk();
        }
        $this->actingAs($this->user('administrador', $ong, false))->getJson($dashboard)->assertUnauthorized();
        $this->getJson($report)->assertUnauthorized();
        $this->actingAs($this->user('administrador', $ong));
        $ong->update(['status' => 'SUSPENSA']);
        $this->getJson($dashboard)->assertForbidden();
        $this->getJson($report)->assertForbidden();
    }

    public function test_dashboard_counts_existing_data_and_isolates_other_ong(): void
    {
        $ong = $this->ong();
        $external = $this->ong();
        $admin = $this->user('administrador', $ong);
        $adopter = $this->user();
        $available = $this->animal($ong);
        $adopted = $this->animal($ong, 'ADOTADO', false);
        $this->animal($ong, 'INDISPONIVEL', false);
        $this->animal($ong, 'EM_PROCESSO_ADOCAO', false);
        $this->animal($ong, 'FALECIDO', false);
        $this->animal($external, 'FALECIDO');
        $request = AdoptionRequest::create([
            'animal_id' => $adopted->id, 'ong_id' => $ong->id, 'usuario_id' => $adopter->id, 'status' => 'CONCLUIDA',
        ]);
        Adoption::create([
            'adoption_request_id' => $request->id, 'animal_id' => $adopted->id, 'ong_id' => $ong->id,
            'usuario_id' => $adopter->id, 'confirmado_por' => $admin->id, 'data_entrega' => now(),
        ]);
        AdoptionRequest::create([
            'animal_id' => $available->id, 'ong_id' => $ong->id, 'usuario_id' => $adopter->id, 'status' => 'PENDENTE',
        ]);
        $sponsor = Sponsorship::create([
            'animal_id' => $available->id, 'ong_id' => $ong->id, 'usuario_id' => $adopter->id,
            'modalidade' => 'MENSAL', 'valor' => '35.50', 'status' => 'ATIVO', 'data_inicio' => today()->toDateString(),
        ]);
        $sponsor->parcelas()->create(['numero' => 1, 'valor' => '35.50', 'vencimento' => today()->subDay()->toDateString(), 'status' => 'PENDENTE']);
        Sponsorship::create([
            'animal_id' => $available->id, 'ong_id' => $ong->id, 'usuario_id' => $this->user()->id,
            'modalidade' => 'UNICO', 'valor' => '10.00', 'status' => 'ENCERRADO',
            'data_inicio' => today()->toDateString(), 'data_encerramento' => today()->toDateString(),
        ]);
        MedicalRecord::create([
            'animal_id' => $available->id, 'ong_id' => $ong->id, 'registrado_por' => $admin->id,
            'tipo' => 'CONSULTA', 'titulo' => 'Consulta', 'descricao' => 'Exame', 'data_procedimento' => today()->toDateString(),
        ]);
        MedicalRecord::create([
            'animal_id' => $available->id, 'ong_id' => $ong->id, 'registrado_por' => $admin->id,
            'tipo' => 'VACINA', 'titulo' => 'Vacina', 'descricao' => 'Dose', 'data_procedimento' => today()->toDateString(),
        ]);
        MedicalRecord::create([
            'animal_id' => $external->animais()->firstOrFail()->id, 'ong_id' => $external->id,
            'registrado_por' => $this->user('veterinario', $external)->id,
            'tipo' => 'CIRURGIA', 'titulo' => 'Externa', 'descricao' => 'Externa', 'data_procedimento' => today()->toDateString(),
        ]);
        Donation::create(['ong_id' => $ong->id, 'usuario_id' => $adopter->id, 'valor' => '25.50', 'status' => 'PENDENTE']);
        Donation::create(['ong_id' => $external->id, 'usuario_id' => $adopter->id, 'valor' => '999.00', 'status' => 'CONFIRMADA', 'confirmado_em' => now()]);
        $this->finance($external, 'RECEITA', 'DOACAO', '999.00');

        $this->actingAs($admin)->getJson('/api/v1/ong/dashboard')->assertOk()
            ->assertJsonPath('animais.total', 5)->assertJsonPath('animais.disponiveis', 1)
            ->assertJsonPath('animais.adotados', 1)->assertJsonPath('animais.publicados', 1)
            ->assertJsonPath('animais.indisponiveis', 1)->assertJsonPath('animais.emProcessoAdocao', 1)
            ->assertJsonPath('animais.falecidos', 1)
            ->assertJsonPath('adocoes.solicitacoesPendentes', 1)->assertJsonPath('adocoes.concluidas', 1)
            ->assertJsonPath('apadrinhamentos.ativos', 1)->assertJsonPath('apadrinhamentos.encerrados', 1)
            ->assertJsonPath('apadrinhamentos.parcelasVencidas', 1)
            ->assertJsonPath('clinico.totalRegistros', 2)->assertJsonPath('clinico.consultas', 1)
            ->assertJsonPath('clinico.vacinas', 1)->assertJsonPath('doacoes.pendentes', 1)
            ->assertJsonPath('financeiro.saldoRealizado', '0.00');
        $yesterday = today()->subDay()->toDateString();
        $this->getJson("/api/v1/ong/dashboard?de={$yesterday}&ate={$yesterday}")
            ->assertJsonPath('animais.adotados', 1)->assertJsonPath('adocoes.concluidas', 0);
    }

    public function test_financial_report_reuses_realized_balance_without_double_counting_origins(): void
    {
        $ong = $this->ong();
        $other = $this->ong();
        $admin = $this->user('administrador', $ong);
        $donation = Donation::create([
            'ong_id' => $ong->id, 'usuario_id' => $this->user()->id,
            'valor' => '25.50', 'status' => 'CONFIRMADA', 'confirmado_em' => now(),
        ]);
        $animal = $this->animal($ong);
        $sponsor = Sponsorship::create([
            'animal_id' => $animal->id, 'ong_id' => $ong->id, 'usuario_id' => $this->user()->id,
            'modalidade' => 'UNICO', 'valor' => '35.50', 'status' => 'ENCERRADO', 'data_inicio' => today()->toDateString(),
        ]);
        $part = $sponsor->parcelas()->create([
            'numero' => 1, 'valor' => '35.50', 'vencimento' => today()->toDateString(), 'status' => 'CONFIRMADA',
            'confirmado_em' => now(), 'confirmado_por' => $admin->id,
        ]);
        $this->finance($ong, 'RECEITA', 'DOACAO', '25.50', 'REALIZADA', 'DOACAO', $donation->id);
        $this->finance($ong, 'RECEITA', 'APADRINHAMENTO', '35.50', 'REALIZADA', 'APADRINHAMENTO', $part->id);
        $this->finance($ong, 'RECEITA', 'EVENTO', '100.25');
        $this->finance($ong, 'DESPESA', 'ALIMENTACAO', '40.10');
        $this->finance($ong, 'DESPESA', 'MEDICAMENTOS', '9.00', 'APROVADA');
        $this->finance($ong, 'RECEITA', 'OUTRA_RECEITA', '5.00', 'PENDENTE');
        $this->finance($other, 'RECEITA', 'EVENTO', '999.99');

        $this->actingAs($admin)->getJson('/api/v1/ong/relatorios/financeiro')->assertOk()
            ->assertJsonPath('receitasRealizadas', '161.25')
            ->assertJsonPath('despesasRealizadas', '40.10')
            ->assertJsonPath('saldoRealizado', '121.15')
            ->assertJsonPath('receitasPendentes', '5.00')
            ->assertJsonPath('despesasAprovadas', '9.00')
            ->assertJsonPath('quantidadeMovimentacoes', 6)
            ->assertJsonPath('receitasPorCategoria.DOACAO', '25.50')
            ->assertJsonPath('receitasPorCategoria.APADRINHAMENTO', '35.50')
            ->assertJsonPath('receitasPorCategoria.EVENTO', '100.25')
            ->assertJsonPath('despesasPorCategoria.ALIMENTACAO', '40.10');
        $this->getJson('/api/v1/ong/finance/resumo')->assertJsonPath('saldoRealizado', '121.15');
        $this->getJson('/api/v1/ong/dashboard')->assertJsonPath('doacoes.valorConfirmado', '25.50')
            ->assertJsonPath('financeiro.receitasRealizadas', '161.25');
        $yesterday = today()->subDay()->toDateString();
        $this->getJson("/api/v1/ong/dashboard?de={$yesterday}&ate={$yesterday}")
            ->assertJsonPath('doacoes.confirmadas', 0)->assertJsonPath('doacoes.valorConfirmado', '0.00');
    }

    public function test_period_filters_events_but_not_current_state_and_rejects_invalid_fields(): void
    {
        $ong = $this->ong();
        $admin = $this->user('administrador', $ong);
        $animal = $this->animal($ong);
        MedicalRecord::create([
            'animal_id' => $animal->id, 'ong_id' => $ong->id, 'registrado_por' => $admin->id,
            'tipo' => 'CONSULTA', 'titulo' => 'Consulta', 'descricao' => 'Exame', 'data_procedimento' => today()->toDateString(),
        ]);
        $this->finance($ong, 'RECEITA', 'EVENTO', '10.05');
        $this->actingAs($admin);
        $yesterday = today()->subDay()->toDateString();
        $today = today()->toDateString();
        $this->getJson("/api/v1/ong/dashboard?de={$yesterday}&ate={$yesterday}")->assertOk()
            ->assertJsonPath('animais.total', 1)->assertJsonPath('clinico.totalRegistros', 0)
            ->assertJsonPath('financeiro.receitasRealizadas', '0.00');
        $this->getJson("/api/v1/ong/dashboard?de={$today}&ate={$today}")->assertOk()
            ->assertJsonPath('clinico.totalRegistros', 1)->assertJsonPath('financeiro.receitasRealizadas', '10.05');
        $this->getJson("/api/v1/ong/relatorios/financeiro?de={$yesterday}&ate={$yesterday}")
            ->assertJsonPath('quantidadeMovimentacoes', 0)->assertJsonPath('saldoRealizado', '0.00');
        $this->getJson("/api/v1/ong/relatorios/financeiro?de={$today}&ate={$today}")
            ->assertJsonPath('quantidadeMovimentacoes', 1)->assertJsonPath('saldoRealizado', '10.05');
        $this->getJson("/api/v1/ong/dashboard?de={$today}&ate={$yesterday}")->assertStatus(400);
        $this->getJson('/api/v1/ong/dashboard?ongId=999')->assertStatus(400);
        $this->getJson('/api/v1/ong/relatorios/financeiro?ong_id=999')->assertStatus(400);
    }

    public function test_query_count_remains_constant_when_more_records_exist(): void
    {
        $ong = $this->ong();
        $this->actingAs($this->user('administrador', $ong));
        $this->animal($ong);
        $this->finance($ong, 'RECEITA', 'EVENTO', '1.00');
        DB::enableQueryLog();
        $this->getJson('/api/v1/ong/dashboard')->assertOk();
        $dashboardOne = count(DB::getQueryLog());
        DB::flushQueryLog();
        $this->getJson('/api/v1/ong/relatorios/financeiro')->assertOk();
        $reportOne = count(DB::getQueryLog());
        for ($i = 0; $i < 14; $i++) {
            $this->animal($ong);
            $this->finance($ong, 'RECEITA', 'EVENTO', '1.00');
        }
        DB::flushQueryLog();
        $this->getJson('/api/v1/ong/dashboard')->assertOk()->assertJsonPath('animais.total', 15);
        $dashboardFifteen = count(DB::getQueryLog());
        DB::flushQueryLog();
        $this->getJson('/api/v1/ong/relatorios/financeiro')->assertOk()->assertJsonPath('quantidadeMovimentacoes', 15);
        $reportFifteen = count(DB::getQueryLog());
        DB::disableQueryLog();
        $this->assertSame($dashboardOne, $dashboardFifteen);
        $this->assertSame($reportOne, $reportFifteen);
    }
}
