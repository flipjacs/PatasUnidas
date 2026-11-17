<?php

namespace Tests\Feature;

use App\Models\Animal;
use App\Models\Donation;
use App\Models\FinancialTransaction;
use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class InstitutionalContractTest extends TestCase
{
    use RefreshDatabase;

    private function ong(string $name): Ong
    {
        return Ong::create(['nome' => $name, 'email' => uniqid().'@patas.test', 'status' => 'ATIVA']);
    }

    private function user(string $role, ?Ong $ong = null): Usuario
    {
        return Usuario::create(['nome' => 'Pessoa Teste', 'email' => uniqid().'@patas.test',
            'senha_hash' => Hash::make('SenhaDemo123!'), 'perfil' => $role, 'ong_id' => $ong?->id, 'ativo' => true]);
    }

    private function animal(Ong $ong, string $name): Animal
    {
        return Animal::create(['ong_id' => $ong->id, 'nome' => $name, 'especie' => 'GATO',
            'sexo' => 'FEMEA', 'porte' => 'PEQUENO', 'idade_aproximada' => 12, 'situacao' => 'DISPONIVEL']);
    }

    public function test_session_includes_only_own_institution_when_present(): void
    {
        $ong = $this->ong('Patas A');
        $this->actingAs($this->user('administrador', $ong))->getJson('/api/v1/auth/me')
            ->assertOk()->assertJsonPath('ong.nome', 'Patas A')->assertJsonPath('ong.status', 'ATIVA')
            ->assertJsonPath('ongId', $ong->id)->assertJsonMissingPath('ong.email');
        $this->actingAs($this->user('usuario'))->getJson('/api/v1/auth/me')
            ->assertOk()->assertJsonPath('ong', null)->assertJsonPath('ongId', null);
        $this->actingAs($this->user('criador_plataforma'))->getJson('/api/v1/auth/me')
            ->assertOk()->assertJsonPath('ong', null);
    }

    public function test_animal_search_keeps_filters_tenant_and_private_primary_photo(): void
    {
        $ong = $this->ong('Patas A');
        $other = $this->ong('Patas B');
        $animal = $this->animal($ong, 'Thor');
        $animal->fotos()->create(['caminho' => 'animais/demo.webp', 'principal' => true]);
        $this->animal($ong, 'Mel');
        $this->animal($other, 'Thor Externo');
        $this->actingAs($this->user('administrador', $ong))->getJson('/api/v1/ong/animais?busca=Thor&especie=GATO')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $animal->id)
            ->assertJsonPath('data.0.fotoPrincipal.principal', true)->assertJsonPath('meta.total', 1);
        $url = route('ong.animais.fotos.arquivo', ['animal' => $animal->id, 'foto' => $animal->fotos()->firstOrFail()->id]);
        $this->assertStringContainsString('/api/v1/ong/animais/', $url);
        $this->assertStringNotContainsString('/storage/', $url);
        $this->actingAs($this->user('usuario'))->getJson('/api/v1/ong/animais?busca=Thor')->assertForbidden();
    }

    public function test_animal_photo_listing_does_not_add_a_query_per_animal(): void
    {
        $ong = $this->ong('Patas A');
        $this->actingAs($this->user('administrador', $ong));
        $first = $this->animal($ong, 'Animal 1');
        $first->fotos()->create(['caminho' => 'animais/1.webp', 'principal' => true]);
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->getJson('/api/v1/ong/animais')->assertOk()->assertJsonCount(1, 'data');
        $one = count(DB::getQueryLog());
        for ($i = 2; $i <= 15; $i++) {
            $animal = $this->animal($ong, 'Animal '.$i);
            $animal->fotos()->create(['caminho' => 'animais/'.$i.'.webp', 'principal' => true]);
        }
        DB::flushQueryLog();
        $this->getJson('/api/v1/ong/animais')->assertOk()->assertJsonCount(15, 'data');
        $fifteen = count(DB::getQueryLog());
        DB::disableQueryLog();
        $this->assertSame($one, $fifteen);
    }

    public function test_veterinarian_reads_own_animals_without_administrative_writes(): void
    {
        $ong = $this->ong('Patas A');
        $other = $this->ong('Patas B');
        $animal = $this->animal($ong, 'Thor');
        $external = $this->animal($other, 'Externo');
        $this->actingAs($this->user('veterinario', $ong))->getJson('/api/v1/ong/animais')
            ->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("/api/v1/ong/animais/{$animal->id}")->assertOk();
        $this->getJson("/api/v1/ong/animais/{$external->id}")->assertNotFound();
        $this->postJson('/api/v1/ong/animais', ['nome' => 'Novo', 'especie' => 'GATO', 'sexo' => 'FEMEA',
            'porte' => 'PEQUENO', 'idade_aproximada' => 12])->assertForbidden();
        $this->patchJson("/api/v1/ong/animais/{$animal->id}", ['nome' => 'Alterado'])->assertForbidden();
        $this->patchJson("/api/v1/ong/animais/{$animal->id}/publicar")->assertForbidden();
    }

    public function test_admin_edits_only_own_employee_fields_and_searches_before_pagination(): void
    {
        $ong = $this->ong('Patas A');
        $other = $this->ong('Patas B');
        $admin = $this->user('administrador', $ong);
        $employee = $this->user('voluntario', $ong);
        $external = $this->user('veterinario', $other);
        $this->actingAs($admin)->patchJson("/api/v1/ong/funcionarios/{$employee->id}", [
            'nome' => '  Nova Pessoa  ', 'email' => '  NOVA@PATAS.TEST  ',
        ])->assertOk()->assertJsonPath('nome', 'Nova Pessoa')->assertJsonPath('email', 'nova@patas.test');
        $this->assertSame($ong->id, $employee->fresh()->ong_id);
        $this->assertSame('voluntario', $employee->fresh()->perfil);
        $this->getJson('/api/v1/ong/funcionarios?busca=nova')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/ong/funcionarios?busca=patAs.test')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/ong/funcionarios?busca=Ausente')->assertOk()->assertJsonCount(0, 'data');
        $this->patchJson("/api/v1/ong/funcionarios/{$external->id}", ['nome' => 'Invadido'])->assertNotFound();
        $this->patchJson("/api/v1/ong/funcionarios/{$employee->id}", ['ong_id' => $other->id])->assertStatus(400);
        $this->patchJson("/api/v1/ong/funcionarios/{$employee->id}", ['perfil' => 'ADMINISTRADOR'])->assertStatus(400);
        $this->patchJson("/api/v1/ong/funcionarios/{$employee->id}", ['email' => $admin->email])->assertStatus(400);
        $this->actingAs($this->user('voluntario', $ong))
            ->patchJson("/api/v1/ong/funcionarios/{$employee->id}", ['nome' => 'Negado'])->assertForbidden();
        $this->actingAs($this->user('veterinario', $ong))
            ->patchJson("/api/v1/ong/funcionarios/{$employee->id}", ['nome' => 'Negado'])->assertForbidden();
    }

    public function test_donor_cancels_only_own_pending_donation_without_financial_entry(): void
    {
        $ong = $this->ong('Patas A');
        $donor = $this->user('usuario');
        $other = $this->user('usuario');
        $donation = Donation::create(['ong_id' => $ong->id, 'usuario_id' => $donor->id,
            'valor' => '25.50', 'status' => 'PENDENTE']);
        $this->actingAs($other)->patchJson("/api/v1/me/donations/{$donation->id}/cancelar")->assertNotFound();
        $this->actingAs($donor)->patchJson("/api/v1/me/donations/{$donation->id}/cancelar")
            ->assertOk()->assertJsonPath('status', 'CANCELADA');
        $this->assertSame($donor->id, $donation->fresh()->cancelado_por);
        $this->assertNotNull($donation->fresh()->cancelado_em);
        $this->assertDatabaseCount('financial_transactions', 0);
        $this->patchJson("/api/v1/me/donations/{$donation->id}/cancelar")->assertConflict();
        $this->actingAs($this->user('administrador', $ong))
            ->patchJson("/api/v1/ong/donations/{$donation->id}/confirmar")->assertConflict();
    }

    public function test_confirmed_donation_cannot_be_cancelled_by_donor(): void
    {
        $ong = $this->ong('Patas A');
        $donor = $this->user('usuario');
        $donation = Donation::create(['ong_id' => $ong->id, 'usuario_id' => $donor->id,
            'valor' => '25.50', 'status' => 'PENDENTE']);
        $this->actingAs($this->user('administrador', $ong))
            ->patchJson("/api/v1/ong/donations/{$donation->id}/confirmar")->assertOk();
        $this->actingAs($donor)
            ->patchJson("/api/v1/me/donations/{$donation->id}/cancelar")->assertConflict();
        $this->assertSame('CONFIRMADA', $donation->fresh()->status);
        $this->assertSame(1, FinancialTransaction::where('origem_tipo', 'DOACAO')->where('origem_id', $donation->id)->count());
    }
}
