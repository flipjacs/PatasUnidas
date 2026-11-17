<?php

namespace Tests\Feature;

use App\Models\Animal;
use App\Models\MedicalRecord;
use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class MedicalRecordApiTest extends TestCase
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

    private function user(string $role, ?int $ongId = null, bool $active = true): Usuario
    {
        return Usuario::create(['nome' => 'Pessoa', 'email' => uniqid().'@example.org', 'senha_hash' => Hash::make('Oito123!'), 'perfil' => $role, 'ong_id' => $ongId, 'ativo' => $active]);
    }

    private function animal(int $ongId, string $state = 'DISPONIVEL'): Animal
    {
        return Animal::create(['ong_id' => $ongId, 'nome' => 'Thor', 'especie' => 'CACHORRO', 'sexo' => 'MACHO', 'porte' => 'MEDIO', 'idade_aproximada' => 36, 'situacao' => $state]);
    }

    private function payload(string $type = 'CONSULTA', string $date = '2026-11-12'): array
    {
        return ['tipo' => $type, 'titulo' => 'Atendimento', 'descricao' => 'Avaliação clínica realizada.', 'dataProcedimento' => $date];
    }

    private function record(Animal $animal, Usuario $author, string $type = 'CONSULTA', string $date = '2026-11-12'): MedicalRecord
    {
        return MedicalRecord::create(['animal_id' => $animal->id, 'ong_id' => $animal->ong_id, 'registrado_por' => $author->id, 'tipo' => $type, 'titulo' => 'Atendimento', 'descricao' => 'Descrição clínica.', 'data_procedimento' => $date]);
    }

    public function test_veterinarian_and_admin_create_records_for_own_animal(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $veterinarian = $this->user('veterinario', $ong->id);
        $url = "/api/v1/ong/animais/{$animal->id}/prontuarios";
        $this->actingAs($veterinarian)->postJson($url, [...$this->payload('VACINA'), 'profissionalResponsavel' => 'Dra. Ana', 'medicamentos' => 'Vacina', 'observacoes' => 'Sem reações.'])
            ->assertCreated()->assertJsonPath('tipo', 'VACINA')->assertJsonPath('registradoPor.id', $veterinarian->id)->assertJsonMissingPath('registradoPor.email');
        $this->assertDatabaseHas('medical_records', ['animal_id' => $animal->id, 'ong_id' => $ong->id, 'registrado_por' => $veterinarian->id]);
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($this->user('administrador', $ong->id))->postJson($url, $this->payload('EXAME'))->assertCreated();
    }

    public function test_roles_inactive_accounts_and_suspended_ongs_are_blocked(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $url = "/api/v1/ong/animais/{$animal->id}/prontuarios";
        $this->postJson($url, $this->payload())->assertUnauthorized();
        foreach (['usuario', 'criador_plataforma', 'voluntario'] as $role) {
            $this->actingAs($this->user($role, $role === 'voluntario' ? $ong->id : null))->postJson($url, $this->payload())->assertForbidden();
            $this->postJson('/api/v1/auth/logout')->assertOk();
        }
        $this->actingAs($this->user('veterinario', $ong->id, false))->postJson($url, $this->payload())->assertUnauthorized();
        $this->actingAs($this->user('veterinario', $ong->id));
        $ong->update(['status' => 'SUSPENSA']);
        $this->postJson($url, $this->payload())->assertForbidden();
    }

    public function test_invalid_future_date_type_and_internal_fields_are_rejected(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $url = "/api/v1/ong/animais/{$animal->id}/prontuarios";
        $this->actingAs($this->user('administrador', $ong->id));
        foreach ([['tipo' => 'OUTRO'], ['dataProcedimento' => '2999-01-01'], ['titulo' => ''], ['descricao' => ''], ['animal_id' => 999], ['ong_id' => 999], ['registrado_por' => 999]] as $change) {
            $this->postJson($url, [...$this->payload(), ...$change])->assertStatus(400);
        }
        $this->postJson($url, $this->payload('OBSERVACAO', '2020-01-01'))->assertCreated();
        $this->assertDatabaseCount('medical_records', 1);
    }

    public function test_external_animal_and_record_from_another_animal_return_404(): void
    {
        $ong = $this->ong();
        $other = $this->ong();
        $animal = $this->animal($ong->id);
        $external = $this->animal($other->id);
        $record = $this->record($external, $this->user('veterinario', $other->id));
        $this->actingAs($this->user('administrador', $ong->id));
        $this->postJson("/api/v1/ong/animais/{$external->id}/prontuarios", $this->payload())->assertNotFound();
        $this->getJson("/api/v1/ong/animais/{$external->id}/prontuarios")->assertNotFound();
        $this->getJson("/api/v1/ong/animais/{$animal->id}/prontuarios/{$record->id}")->assertNotFound();
    }

    public function test_history_filters_paginates_orders_and_allows_volunteer_read(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $author = $this->user('veterinario', $ong->id);
        $old = $this->record($animal, $author, 'CONSULTA', '2020-01-01');
        for ($i = 0; $i < 15; $i++) {
            $this->record($animal, $author, 'VACINA', '2026-11-12');
        }
        $this->actingAs($this->user('voluntario', $ong->id));
        $url = "/api/v1/ong/animais/{$animal->id}/prontuarios";
        $this->getJson($url)->assertOk()->assertJsonCount(15, 'data')->assertJsonPath('meta.total', 16)
            ->assertJsonPath('data.0.id', MedicalRecord::max('id'));
        $this->getJson($url.'?tipo=CONSULTA&de=2020-01-01&ate=2020-01-01')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $old->id);
        $this->getJson("$url/{$old->id}")->assertOk()->assertJsonPath('dataProcedimento', '2020-01-01');
    }

    public function test_adopted_and_deceased_animals_keep_history_but_reject_new_procedures(): void
    {
        $ong = $this->ong();
        $author = $this->user('veterinario', $ong->id);
        $this->actingAs($author);
        foreach (['ADOTADO', 'FALECIDO'] as $state) {
            $animal = $this->animal($ong->id, $state);
            $record = $this->record($animal, $author);
            $url = "/api/v1/ong/animais/{$animal->id}/prontuarios";
            $this->getJson($url)->assertJsonCount(1, 'data');
            $this->getJson("$url/{$record->id}")->assertOk();
            $this->postJson($url, $this->payload())->assertConflict();
        }
        $this->assertDatabaseCount('medical_records', 2);
    }

    public function test_unavailable_and_reserved_animals_can_still_receive_clinical_records(): void
    {
        $ong = $this->ong();
        $this->actingAs($this->user('veterinario', $ong->id));
        foreach (['INDISPONIVEL', 'EM_PROCESSO_ADOCAO'] as $state) {
            $animal = $this->animal($ong->id, $state);
            $this->postJson("/api/v1/ong/animais/{$animal->id}/prontuarios", $this->payload())->assertCreated();
        }
    }

    public function test_no_common_update_or_delete_routes_exist(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $record = $this->record($animal, $this->user('veterinario', $ong->id));
        $this->actingAs($this->user('administrador', $ong->id));
        $url = "/api/v1/ong/animais/{$animal->id}/prontuarios/{$record->id}";
        $this->patchJson($url, ['titulo' => 'Alterado'])->assertStatus(405);
        $this->deleteJson($url)->assertStatus(405);
        $this->assertSame('Atendimento', $record->fresh()->titulo);
    }

    public function test_listing_query_count_stays_constant(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $author = $this->user('veterinario', $ong->id);
        $this->record($animal, $author);
        $this->actingAs($author);
        $url = "/api/v1/ong/animais/{$animal->id}/prontuarios";
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->getJson($url)->assertJsonCount(1, 'data');
        $one = count(DB::getQueryLog());
        for ($i = 0; $i < 14; $i++) {
            $this->record($animal, $author);
        }
        DB::flushQueryLog();
        $this->getJson($url)->assertJsonCount(15, 'data');
        $fifteen = count(DB::getQueryLog());
        DB::disableQueryLog();
        $this->assertSame($one, $fifteen);
    }
}
