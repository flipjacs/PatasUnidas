<?php

namespace Tests\Feature;

use App\Models\Adoption;
use App\Models\AdoptionRequest;
use App\Models\Animal;
use App\Models\MedicalRecord;
use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class MedicalRecordCorrectionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://127.0.0.1:5174');
    }

    private function setupRecord(string $state = 'DISPONIVEL'): array
    {
        $ong = Ong::create(['nome' => 'ONG', 'email' => uniqid().'@example.org', 'status' => 'ATIVA']);
        $admin = $this->user('administrador', $ong);
        $animal = Animal::create(['ong_id' => $ong->id, 'nome' => 'Thor', 'especie' => 'CACHORRO', 'sexo' => 'MACHO', 'porte' => 'MEDIO', 'idade_aproximada' => 36, 'situacao' => $state]);
        $record = MedicalRecord::create(['animal_id' => $animal->id, 'ong_id' => $ong->id, 'registrado_por' => $admin->id, 'tipo' => 'CONSULTA', 'titulo' => 'Original', 'descricao' => 'Descrição original', 'data_procedimento' => '2020-01-01']);

        return [$ong, $admin, $animal, $record];
    }

    private function user(string $role, ?Ong $ong = null, bool $active = true): Usuario
    {
        return Usuario::create(['nome' => 'Pessoa', 'email' => uniqid().'@example.org', 'senha_hash' => Hash::make('Oito123!'), 'perfil' => $role, 'ong_id' => $ong?->id, 'ativo' => $active]);
    }

    public function test_correction_preserves_versions_and_original_author(): void
    {
        [$ong, $author, $animal, $record] = $this->setupRecord('ADOTADO');
        $veterinarian = $this->user('veterinario', $ong);
        $url = "/api/v1/ong/animais/{$animal->id}/prontuarios/{$record->id}";
        $this->actingAs($veterinarian)->patchJson($url.'/corrigir', ['titulo' => 'Corrigido', 'justificativa' => 'Revisão clínica'])->assertOk()->assertJsonPath('titulo', 'Corrigido');
        $this->patchJson($url.'/corrigir', ['descricao' => 'Descrição nova', 'justificativa' => 'Complemento'])->assertOk();
        $history = $this->getJson($url.'/correcoes')->assertOk()->assertJsonCount(2, 'data');
        $this->assertSame('Original', $history->json('data.0.dadosAnteriores.titulo'));
        $this->assertSame('Corrigido', $history->json('data.0.dadosNovos.titulo'));
        $this->assertSame('Corrigido', $history->json('data.1.dadosAnteriores.titulo'));
        $this->assertSame('Descrição nova', $history->json('data.1.dadosNovos.descricao'));
        $this->assertSame($author->id, $record->fresh()->registrado_por);
        $this->assertSame($veterinarian->id, $history->json('data.0.corrigidoPor.id'));
    }

    public function test_correction_rejects_unauthorized_invalid_or_unchanged_data(): void
    {
        [$ong, $author, $animal, $record] = $this->setupRecord('FALECIDO');
        $url = "/api/v1/ong/animais/{$animal->id}/prontuarios/{$record->id}";
        $this->patchJson($url.'/corrigir', ['titulo' => 'Novo', 'justificativa' => 'Revisão'])->assertUnauthorized();
        foreach (['voluntario', 'usuario', 'criador_plataforma'] as $role) {
            $this->actingAs($this->user($role, $role === 'voluntario' ? $ong : null))->patchJson($url.'/corrigir', ['titulo' => 'Novo', 'justificativa' => 'Revisão'])->assertForbidden();
            $this->postJson('/api/v1/auth/logout')->assertOk();
        }
        $this->actingAs($this->user('administrador', $ong));
        foreach ([['titulo' => 'Novo'], ['titulo' => 'Original', 'justificativa' => 'Sem mudança'], ['animal_id' => 999, 'justificativa' => 'Inválido'], ['dataProcedimento' => '2999-01-01', 'justificativa' => 'Inválido']] as $payload) {
            $this->patchJson($url.'/corrigir', $payload)->assertStatus(400);
        }
        $this->patchJson($url.'/corrigir', ['titulo' => 'Corrigido', 'justificativa' => 'Revisão'])->assertOk();
        $ong->update(['status' => 'SUSPENSA']);
        $this->patchJson($url.'/corrigir', ['titulo' => 'Outro', 'justificativa' => 'Revisão'])->assertForbidden();
        $this->assertSame($author->id, $record->fresh()->registrado_por);
        $this->assertDatabaseCount('medical_record_corrections', 1);
    }

    public function test_adopter_requires_completed_adoption_and_gets_read_only_resource(): void
    {
        [$ong, $admin, $animal, $record] = $this->setupRecord('ADOTADO');
        $adopter = $this->user('usuario');
        $other = $this->user('usuario');
        $base = "/api/v1/me/animais-adotados/{$animal->id}/prontuarios";
        $this->actingAs($adopter)->getJson($base)->assertNotFound();
        $request = AdoptionRequest::create(['animal_id' => $animal->id, 'ong_id' => $ong->id, 'usuario_id' => $adopter->id, 'status' => 'APROVADA']);
        $this->getJson($base)->assertNotFound();
        $request->update(['status' => 'CONCLUIDA']);
        Adoption::create(['adoption_request_id' => $request->id, 'animal_id' => $animal->id, 'ong_id' => $ong->id, 'usuario_id' => $adopter->id, 'confirmado_por' => $admin->id, 'data_entrega' => now()]);
        $ong->update(['status' => 'SUSPENSA']);
        $this->getJson($base)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson($base.'/'.$record->id)->assertOk()->assertJsonPath('titulo', 'Original')->assertJsonMissingPath('registradoPor')->assertJsonMissingPath('ongId');
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($other)->getJson($base)->assertNotFound();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($adopter)->getJson($base.'/'.($record->id + 999))->assertNotFound();
        $this->postJson($base, ['titulo' => 'Novo'])->assertStatus(405);
    }

    public function test_external_records_and_animal_relationship_are_hidden(): void
    {
        [$ong, $admin, $animal, $record] = $this->setupRecord();
        [$otherOng, $otherAdmin, $otherAnimal, $otherRecord] = $this->setupRecord();
        $this->actingAs($admin);
        $this->patchJson("/api/v1/ong/animais/{$otherAnimal->id}/prontuarios/{$otherRecord->id}/corrigir", ['titulo' => 'Novo', 'justificativa' => 'Revisão'])->assertNotFound();
        $this->getJson("/api/v1/ong/animais/{$animal->id}/prontuarios/{$otherRecord->id}/correcoes")->assertNotFound();
        $this->assertSame('Original', $otherRecord->fresh()->titulo);
    }

    public function test_adopter_filters_pagination_and_other_animal_record_is_hidden(): void
    {
        [$ong, $admin, $animal, $record] = $this->setupRecord('ADOTADO');
        $adopter = $this->user('usuario');
        $request = AdoptionRequest::create(['animal_id' => $animal->id, 'ong_id' => $ong->id, 'usuario_id' => $adopter->id, 'status' => 'CONCLUIDA']);
        Adoption::create(['adoption_request_id' => $request->id, 'animal_id' => $animal->id, 'ong_id' => $ong->id, 'usuario_id' => $adopter->id, 'confirmado_por' => $admin->id, 'data_entrega' => now()]);
        for ($i = 0; $i < 15; $i++) {
            MedicalRecord::create(['animal_id' => $animal->id, 'ong_id' => $ong->id, 'registrado_por' => $admin->id, 'tipo' => 'VACINA', 'titulo' => 'Vacina', 'descricao' => 'Aplicada', 'data_procedimento' => '2021-01-01']);
        }
        $otherAnimal = Animal::create(['ong_id' => $ong->id, 'nome' => 'Mel', 'especie' => 'CACHORRO', 'sexo' => 'FEMEA', 'porte' => 'MEDIO', 'idade_aproximada' => 12]);
        $otherRecord = MedicalRecord::create(['animal_id' => $otherAnimal->id, 'ong_id' => $ong->id, 'registrado_por' => $admin->id, 'tipo' => 'CONSULTA', 'titulo' => 'Outro', 'descricao' => 'Outro', 'data_procedimento' => '2020-01-01']);
        $base = "/api/v1/me/animais-adotados/{$animal->id}/prontuarios";
        $this->actingAs($adopter)->getJson($base)->assertOk()->assertJsonCount(15, 'data')->assertJsonPath('meta.total', 16);
        $this->getJson($base.'?tipo=CONSULTA&de=2020-01-01&ate=2020-01-01')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $record->id);
        $this->getJson($base.'/'.$otherRecord->id)->assertNotFound();
        $this->getJson("/api/v1/me/animais-adotados/{$otherAnimal->id}/prontuarios")->assertNotFound();
    }

    public function test_failed_record_update_rolls_back_correction(): void
    {
        [$ong, $admin, $animal, $record] = $this->setupRecord();
        DB::statement('CREATE TRIGGER reject_medical_update BEFORE UPDATE ON medical_records BEGIN SELECT RAISE(ABORT, "simulated failure"); END');
        $this->actingAs($admin)->patchJson("/api/v1/ong/animais/{$animal->id}/prontuarios/{$record->id}/corrigir", ['titulo' => 'Novo', 'justificativa' => 'Revisão'])->assertStatus(500);
        $this->assertSame('Original', $record->fresh()->titulo);
        $this->assertDatabaseCount('medical_record_corrections', 0);
    }

    public function test_correction_history_query_count_stays_constant(): void
    {
        [$ong, $admin, $animal, $record] = $this->setupRecord();
        $url = "/api/v1/ong/animais/{$animal->id}/prontuarios/{$record->id}";
        $this->actingAs($admin)->patchJson($url.'/corrigir', ['titulo' => 'Versão 1', 'justificativa' => 'Correção'])->assertOk();
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->getJson($url.'/correcoes')->assertJsonCount(1, 'data');
        $one = count(DB::getQueryLog());
        DB::disableQueryLog();
        for ($i = 2; $i <= 15; $i++) {
            $this->patchJson($url.'/corrigir', ['titulo' => "Versão $i", 'justificativa' => 'Correção'])->assertOk();
        }
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->getJson($url.'/correcoes')->assertJsonCount(15, 'data');
        $fifteen = count(DB::getQueryLog());
        DB::disableQueryLog();
        $this->assertSame($one, $fifteen);
    }

    public function test_volunteer_reads_corrections_but_inactive_account_and_suspended_ong_cannot(): void
    {
        [$ong, $admin, $animal, $record] = $this->setupRecord();
        $url = "/api/v1/ong/animais/{$animal->id}/prontuarios/{$record->id}";
        $this->actingAs($admin)->patchJson($url.'/corrigir', ['titulo' => 'Revisado', 'justificativa' => 'Ajuste'])->assertOk();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($this->user('voluntario', $ong))->getJson($url.'/correcoes')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($this->user('veterinario', $ong, false))->getJson($url.'/correcoes')->assertUnauthorized();
        $this->actingAs($admin);
        $ong->update(['status' => 'SUSPENSA']);
        $this->getJson($url.'/correcoes')->assertForbidden();
    }

    public function test_adopter_history_query_count_stays_constant(): void
    {
        [$ong, $admin, $animal, $record] = $this->setupRecord('ADOTADO');
        $adopter = $this->user('usuario');
        $request = AdoptionRequest::create(['animal_id' => $animal->id, 'ong_id' => $ong->id, 'usuario_id' => $adopter->id, 'status' => 'CONCLUIDA']);
        Adoption::create(['adoption_request_id' => $request->id, 'animal_id' => $animal->id, 'ong_id' => $ong->id, 'usuario_id' => $adopter->id, 'confirmado_por' => $admin->id, 'data_entrega' => now()]);
        $url = "/api/v1/me/animais-adotados/{$animal->id}/prontuarios";
        $this->actingAs($adopter);
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->getJson($url)->assertJsonCount(1, 'data');
        $one = count(DB::getQueryLog());
        DB::disableQueryLog();
        for ($i = 0; $i < 14; $i++) {
            $record->replicate()->save();
        }
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->getJson($url)->assertJsonCount(15, 'data');
        $fifteen = count(DB::getQueryLog());
        DB::disableQueryLog();
        $this->assertSame($one, $fifteen);
    }
}
