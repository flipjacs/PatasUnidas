<?php

namespace Tests\Feature;

use App\Models\InventoryCategory;
use App\Models\InventoryProduct;
use App\Models\InventoryUnit;
use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class InventoryApiTest extends TestCase
{
    use RefreshDatabase;

    private const BASE = '/api/v1/ong/estoque';

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://127.0.0.1:5174');
    }

    private function ong(): Ong
    {
        return Ong::create(['nome' => 'ONG F131', 'email' => uniqid().'@example.test', 'status' => 'ATIVA']);
    }

    private function user(string $role, Ong $ong, bool $active = true): Usuario
    {
        return Usuario::create(['nome' => 'Pessoa', 'email' => uniqid().'@example.test', 'perfil' => $role, 'ong_id' => in_array($role, ['usuario', 'criador_plataforma']) ? null : $ong->id, 'ativo' => $active, 'senha_hash' => Hash::make('Oito123!')]);
    }

    private function payload(): array
    {
        return ['nome' => 'Ração F131', 'categoriaId' => InventoryCategory::where('codigo', 'ALIMENTACAO')->value('id'), 'unidadeId' => InventoryUnit::where('codigo', 'KG')->value('id'), 'quantidadeMinima' => '2.500'];
    }

    public function test_catalog_creation_editing_precision_and_duplicate_identity(): void
    {
        $ong = $this->ong();
        $this->actingAs($this->user('administrador', $ong));
        $this->getJson(self::BASE.'/categorias')->assertOk()->assertJsonCount(8, 'data');
        $this->getJson(self::BASE.'/unidades')->assertOk()->assertJsonCount(9, 'data');
        $local = $this->postJson(self::BASE.'/locais', ['nome' => 'Depósito', 'descricao' => 'Principal'])->assertCreated()->json('id');
        $this->postJson(self::BASE.'/locais', ['nome' => 'depósito'])->assertConflict();
        $id = $this->postJson(self::BASE.'/produtos', [...$this->payload(), 'localId' => $local])->assertCreated()
            ->assertJsonPath('quantidadeDisponivel', '0.000')->assertJsonPath('quantidadeMinima', '2.500')->assertJsonPath('unidade.codigo', 'KG')->json('id');
        $this->postJson(self::BASE.'/produtos', $this->payload())->assertConflict();
        $this->postJson(self::BASE.'/produtos', [...$this->payload(), 'marca' => 'Outra marca'])->assertCreated();
        $this->patchJson(self::BASE.'/produtos/'.$id, ['nome' => 'Ração adultos', 'descricao' => 'Nova descrição', 'quantidadeMinima' => '10.750'])->assertOk()->assertJsonPath('quantidadeMinima', '10.750');
        $this->getJson(self::BASE.'/produtos/'.$id)->assertOk()->assertJsonPath('local.nome', 'Depósito');
        $this->patchJson(self::BASE.'/locais/'.$local, ['nome' => 'Sala clínica'])->assertOk();
        $this->patchJson(self::BASE.'/locais/'.$local.'/desativar')->assertOk()->assertJsonPath('ativo', false);
        $this->getJson(self::BASE.'/produtos/'.$id)->assertJsonPath('local.ativo', false);
        $this->assertDatabaseHas('inventory_products', ['id' => $id, 'ong_id' => $ong->id, 'quantidade_disponivel' => 0]);
    }

    public function test_invalid_quantity_references_and_internal_fields_are_rejected(): void
    {
        $this->actingAs($this->user('administrador', $this->ong()));
        $payload = $this->payload();
        foreach (['-1', '1.0001', '1000000000', '1e3', 'abc'] as $minimum) {
            $this->postJson(self::BASE.'/produtos', [...$payload, 'quantidadeMinima' => $minimum])->assertStatus(400);
        }
        foreach (['ong_id' => 2, 'quantidadeDisponivel' => '100', 'quantidade_disponivel' => '100', 'ativo' => false, 'created_at' => '2020-01-01', 'unidade_fixada_em' => '2020-01-01'] as $field => $value) {
            $this->postJson(self::BASE.'/produtos', [...$payload, $field => $value])->assertStatus(400);
        }
        $this->postJson(self::BASE.'/produtos', [...$payload, 'unidadeId' => 9999])->assertStatus(400);
        $box = InventoryUnit::where('codigo', 'CAIXA')->value('id');
        $this->postJson(self::BASE.'/produtos', [...$payload, 'unidadeId' => $box])->assertStatus(400);
        $id = $this->postJson(self::BASE.'/produtos', [...$payload, 'unidadeId' => $box, 'quantidadeMinima' => '2'])->assertCreated()->json('id');
        $this->patchJson(self::BASE.'/produtos/'.$id, ['ong_id' => 99, 'quantidadeDisponivel' => '50'])->assertStatus(400);
        $this->assertDatabaseCount('inventory_products', 1);
    }

    public function test_unit_change_requires_zero_balance_unfixed_unit_and_compatible_minimum(): void
    {
        $this->actingAs($this->user('administrador', $this->ong()));
        $id = $this->postJson(self::BASE.'/produtos', $this->payload())->json('id');
        $box = InventoryUnit::where('codigo', 'CAIXA')->value('id');
        $this->patchJson(self::BASE.'/produtos/'.$id, ['unidadeId' => $box])->assertStatus(400);
        $this->patchJson(self::BASE.'/produtos/'.$id, ['unidadeId' => $box, 'quantidadeMinima' => '2'])->assertOk();
        DB::table('inventory_products')->where('id', $id)->update(['unidade_fixada_em' => now()]);
        $this->patchJson(self::BASE.'/produtos/'.$id, ['unidadeId' => $this->payload()['unidadeId']])->assertConflict();
        $this->patchJson(self::BASE.'/produtos/'.$id, ['unidadeId' => (string) $box])->assertOk();
        $this->patchJson(self::BASE.'/produtos/'.$id, ['descricao' => 'Mantém unidade'])->assertOk();
        DB::table('inventory_products')->where('id', $id)->update(['unidade_fixada_em' => null, 'quantidade_disponivel' => '1.000']);
        $this->patchJson(self::BASE.'/produtos/'.$id, ['unidadeId' => $this->payload()['unidadeId']])->assertConflict();
    }

    public function test_role_permissions_and_active_institution(): void
    {
        $ong = $this->ong();
        $this->getJson(self::BASE.'/produtos')->assertUnauthorized();
        $this->actingAs($this->user('voluntario', $ong));
        $id = $this->postJson(self::BASE.'/produtos', $this->payload())->assertCreated()->json('id');
        $this->patchJson(self::BASE.'/produtos/'.$id, ['descricao' => 'Organização'])->assertOk();
        $this->patchJson(self::BASE.'/produtos/'.$id.'/desativar')->assertForbidden();
        $this->postJson(self::BASE.'/categorias', ['nome' => 'Minha categoria'])->assertForbidden();
        $this->postJson(self::BASE.'/locais', ['nome' => 'Sala'])->assertForbidden();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($this->user('veterinario', $ong));
        $this->getJson(self::BASE.'/produtos/'.$id)->assertOk();
        $this->getJson(self::BASE.'/unidades')->assertOk();
        $this->getJson(self::BASE.'/locais')->assertOk();
        $this->postJson(self::BASE.'/produtos', $this->payload())->assertForbidden();
        $this->patchJson(self::BASE.'/produtos/'.$id, ['nome' => 'Negado'])->assertForbidden();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        foreach (['usuario', 'criador_plataforma'] as $role) {
            $this->actingAs($this->user($role, $ong))->getJson(self::BASE.'/produtos')->assertForbidden();
            $this->postJson('/api/v1/auth/logout')->assertOk();
        }
        $this->actingAs($this->user('administrador', $ong, false))->getJson(self::BASE.'/produtos')->assertUnauthorized();
        $this->actingAs($this->user('administrador', $ong));
        $ong->update(['status' => 'SUSPENSA']);
        $this->getJson(self::BASE.'/produtos')->assertForbidden();
    }

    public function test_custom_categories_and_multi_ong_isolation(): void
    {
        $a = $this->ong();
        $b = $this->ong();
        $this->actingAs($this->user('administrador', $a));
        $category = $this->postJson(self::BASE.'/categorias', ['nome' => 'Resgate'])->assertCreated()->json('id');
        $this->postJson(self::BASE.'/categorias', ['nome' => 'resgate'])->assertConflict();
        $this->postJson(self::BASE.'/categorias', ['nome' => 'Outra', 'ong_id' => $b->id])->assertStatus(400);
        $this->patchJson(self::BASE.'/categorias/'.$category, ['nome' => 'Resgate especial'])->assertOk();
        $global = $this->payload()['categoriaId'];
        $this->patchJson(self::BASE.'/categorias/'.$global, ['nome' => 'Troca global'])->assertNotFound();
        $local = $this->postJson(self::BASE.'/locais', ['nome' => 'Privado'])->json('id');
        $payload = [...$this->payload(), 'categoriaId' => $category, 'localId' => $local];
        $id = $this->postJson(self::BASE.'/produtos', $payload)->assertCreated()->json('id');
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($this->user('administrador', $b));
        $this->getJson(self::BASE.'/produtos/'.$id)->assertNotFound();
        $this->patchJson(self::BASE.'/produtos/'.$id, ['nome' => 'Intruso'])->assertNotFound();
        $this->getJson(self::BASE.'/categorias')->assertJsonCount(8, 'data');
        $this->getJson(self::BASE.'/locais')->assertJsonCount(0, 'data');
        $this->postJson(self::BASE.'/produtos', $payload)->assertStatus(400);
        $this->postJson(self::BASE.'/produtos', [...$payload, 'localId' => null])->assertStatus(400);
        $this->postJson(self::BASE.'/produtos', [...$payload, 'categoriaId' => $global])->assertStatus(400);
        $this->getJson(self::BASE.'/produtos?localId='.$local)->assertStatus(400);
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->actingAs($this->user('administrador', $a));
        $this->patchJson(self::BASE.'/categorias/'.$category.'/desativar')->assertOk();
        $this->getJson(self::BASE.'/produtos/'.$id)->assertJsonPath('categoria.ativo', false);
        $this->postJson(self::BASE.'/produtos', [...$payload, 'nome' => 'Novo'])->assertStatus(400);
    }

    public function test_filters_pagination_and_deactivation_preserve_records(): void
    {
        $this->actingAs($this->user('administrador', $this->ong()));
        for ($i = 0; $i < 16; $i++) {
            $this->postJson(self::BASE.'/produtos', [...$this->payload(), 'nome' => 'Produto F131 '.$i])->assertCreated();
        }
        $id = InventoryProduct::first()->id;
        $this->patchJson(self::BASE.'/produtos/'.$id.'/desativar')->assertOk()->assertJsonPath('ativo', false)->assertJsonPath('quantidadeDisponivel', '0.000');
        $this->getJson(self::BASE.'/produtos?busca=F131')->assertJsonCount(15, 'data')->assertJsonPath('meta.total', 16);
        $this->getJson(self::BASE.'/produtos?busca=F131&page=2')->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 16);
        $this->getJson(self::BASE.'/produtos?ativo=0')->assertJsonCount(1, 'data');
        $this->getJson(self::BASE.'/produtos?categoriaId='.$this->payload()['categoriaId'])->assertJsonPath('meta.total', 16);
        $this->getJson(self::BASE.'/produtos?unidadeId='.$this->payload()['unidadeId'])->assertJsonPath('meta.total', 16);
        $this->getJson(self::BASE.'/produtos?ativo=invalid')->assertStatus(400);
        $this->assertDatabaseCount('inventory_products', 16);
    }

    public function test_referenced_category_cannot_be_deleted_from_database(): void
    {
        $this->actingAs($this->user('administrador', $this->ong()));
        $this->postJson(self::BASE.'/produtos', $this->payload())->assertCreated();
        $this->expectException(QueryException::class);
        DB::table('inventory_categories')->where('id', $this->payload()['categoriaId'])->delete();
    }
}
