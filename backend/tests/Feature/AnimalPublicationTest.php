<?php

namespace Tests\Feature;

use App\Models\Animal;
use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AnimalPublicationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://127.0.0.1:5174');
        Storage::fake('public');
    }

    private function ong(string $status = 'ATIVA', string $cidade = 'Manaus'): Ong
    {
        return Ong::create(['nome' => 'ONG Teste', 'email' => 'ong@example.org', 'cidade' => $cidade, 'estado' => 'AM', 'status' => $status]);
    }

    private function user(string $role, ?int $ongId): Usuario
    {
        return Usuario::create([
            'nome' => 'Pessoa', 'email' => uniqid().'-'.$role.'@example.org',
            'senha_hash' => Hash::make('SenhaForte123!'), 'perfil' => $role,
            'ong_id' => $ongId, 'ativo' => true,
        ]);
    }

    private function animal(int $ongId, array $extra = []): Animal
    {
        return Animal::create([
            'ong_id' => $ongId, 'nome' => 'Thor', 'especie' => 'CACHORRO',
            'sexo' => 'MACHO', 'porte' => 'MEDIO', 'idade_aproximada' => 36,
            'situacao' => 'DISPONIVEL', ...$extra,
        ]);
    }

    private function image(): UploadedFile
    {
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9KkxQAAAAASUVORK5CYII=');

        return UploadedFile::fake()->createWithContent('foto.png', $png);
    }

    public function test_publication_is_independent_of_state_and_cannot_be_mass_assigned(): void
    {
        $ong = $this->ong();
        $admin = $this->user('administrador', $ong->id);
        $this->actingAs($admin)->postJson('/api/v1/ong/animais', [
            'nome' => 'Mel', 'especie' => 'GATO', 'sexo' => 'FEMEA', 'porte' => 'PEQUENO', 'idade_aproximada' => 12,
        ])->assertCreated()->assertJsonPath('publicado', false);
        $animal = Animal::firstOrFail();
        $this->postJson('/api/v1/ong/animais', [
            'nome' => 'Nina', 'especie' => 'GATO', 'sexo' => 'FEMEA', 'porte' => 'PEQUENO',
            'idade_aproximada' => 6, 'publicado' => true,
        ])->assertStatus(400);
        $this->patchJson("/api/v1/ong/animais/{$animal->id}", ['publicado' => true])->assertStatus(400);
        $this->patchJson("/api/v1/ong/animais/{$animal->id}/publicar")->assertOk()->assertJsonPath('publicado', true)->assertJsonPath('situacao', 'DISPONIVEL');
        $this->patchJson("/api/v1/ong/animais/{$animal->id}/publicar")->assertOk();
        $this->patchJson("/api/v1/ong/animais/{$animal->id}/despublicar")->assertOk()->assertJsonPath('publicado', false);
    }

    public function test_volunteer_can_publish_but_suspended_ong_and_external_animal_are_blocked(): void
    {
        $ong = $this->ong();
        $other = $this->ong();
        $mine = $this->animal($ong->id);
        $external = $this->animal($other->id);
        $this->actingAs($this->user('voluntario', $ong->id))
            ->patchJson("/api/v1/ong/animais/{$mine->id}/publicar")->assertOk();
        $this->patchJson("/api/v1/ong/animais/{$external->id}/publicar")->assertNotFound();
        $ong->update(['status' => 'SUSPENSA']);
        $this->patchJson("/api/v1/ong/animais/{$mine->id}/despublicar")->assertForbidden();
    }

    public function test_public_user_cannot_publish(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $this->actingAs($this->user('usuario', null))
            ->patchJson("/api/v1/ong/animais/{$animal->id}/publicar")->assertForbidden();
    }

    public function test_photo_upload_primary_switch_and_removal(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $this->actingAs($this->user('administrador', $ong->id));
        $this->post("/api/v1/ong/animais/{$animal->id}/fotos", ['foto' => $this->image()], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('principal', true);
        $first = $animal->fotos()->firstOrFail();
        Storage::disk('public')->assertExists($first->caminho);
        $this->post("/api/v1/ong/animais/{$animal->id}/fotos", ['foto' => $this->image()], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('principal', false);
        $second = $animal->fotos()->orderByDesc('id')->firstOrFail();
        $this->patchJson("/api/v1/ong/animais/{$animal->id}/fotos/{$second->id}/principal")
            ->assertOk()->assertJsonPath('principal', true);
        $this->assertFalse($first->fresh()->principal);
        $this->deleteJson("/api/v1/ong/animais/{$animal->id}/fotos/{$second->id}")->assertOk();
        Storage::disk('public')->assertMissing($second->caminho);
        $this->assertTrue($first->fresh()->principal);
        $this->getJson("/api/v1/ong/animais/{$animal->id}/fotos")->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_invalid_upload_and_eight_photo_limit(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $this->actingAs($this->user('administrador', $ong->id));
        $this->post("/api/v1/ong/animais/{$animal->id}/fotos", [
            'foto' => UploadedFile::fake()->createWithContent('fake.svg', '<svg></svg>'),
        ], ['Accept' => 'application/json'])->assertStatus(400);
        $this->post("/api/v1/ong/animais/{$animal->id}/fotos", [
            'foto' => UploadedFile::fake()->createWithContent('large.png', $this->image()->getContent().str_repeat('x', 6 * 1024 * 1024)),
        ], ['Accept' => 'application/json'])->assertStatus(400);
        for ($i = 0; $i < 8; $i++) {
            $this->post("/api/v1/ong/animais/{$animal->id}/fotos", ['foto' => $this->image()], ['Accept' => 'application/json'])->assertCreated();
        }
        $this->post("/api/v1/ong/animais/{$animal->id}/fotos", ['foto' => $this->image()], ['Accept' => 'application/json'])->assertConflict();
        $this->assertSame(8, $animal->fotos()->count());
    }

    public function test_photo_ids_cannot_cross_animals_or_ongs(): void
    {
        $ong = $this->ong();
        $otherOng = $this->ong();
        $mine = $this->animal($ong->id);
        $otherAnimal = $this->animal($otherOng->id);
        $photo = $otherAnimal->fotos()->create(['caminho' => 'animais/teste.png', 'principal' => true]);
        $this->actingAs($this->user('administrador', $ong->id));
        $this->getJson("/api/v1/ong/animais/{$otherAnimal->id}/fotos")->assertNotFound();
        $this->patchJson("/api/v1/ong/animais/{$mine->id}/fotos/{$photo->id}/principal")->assertNotFound();
        $this->deleteJson("/api/v1/ong/animais/{$mine->id}/fotos/{$photo->id}")->assertNotFound();
    }

    public function test_photo_management_requires_authorized_user_and_active_ong(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong->id);
        $url = "/api/v1/ong/animais/{$animal->id}/fotos";
        $this->post($url, ['foto' => $this->image()], ['Accept' => 'application/json'])->assertUnauthorized();
        $this->actingAs($this->user('veterinario', $ong->id))
            ->post($url, ['foto' => $this->image()], ['Accept' => 'application/json'])->assertForbidden();
    }

    public function test_suspended_ong_cannot_upload_photos(): void
    {
        $ong = $this->ong('SUSPENSA');
        $animal = $this->animal($ong->id);
        $this->actingAs($this->user('administrador', $ong->id))
            ->post("/api/v1/ong/animais/{$animal->id}/fotos", ['foto' => $this->image()], ['Accept' => 'application/json'])
            ->assertForbidden();
    }

    public function test_public_catalog_only_returns_eligible_animals_and_safe_fields(): void
    {
        $ong = $this->ong();
        $suspended = $this->ong('SUSPENSA');
        $eligible = $this->animal($ong->id, ['publicado' => true]);
        $eligible->fotos()->create(['caminho' => 'animais/teste.png', 'principal' => true]);
        $excluded = [
            $this->animal($ong->id),
            $this->animal($ong->id, ['publicado' => true, 'situacao' => 'INDISPONIVEL']),
            $this->animal($ong->id, ['publicado' => true, 'situacao' => 'EM_PROCESSO_ADOCAO']),
            $this->animal($ong->id, ['publicado' => true, 'situacao' => 'ADOTADO']),
            $this->animal($ong->id, ['publicado' => true, 'situacao' => 'FALECIDO']),
            $this->animal($suspended->id, ['publicado' => true]),
        ];
        $response = $this->getJson('/api/v1/public/animais')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $eligible->id)->assertJsonPath('data.0.fotoPrincipal.principal', true);
        $response->assertJsonMissingPath('data.0.ong.email')->assertJsonMissingPath('data.0.ong.usuarios');
        $this->getJson("/api/v1/public/animais/{$eligible->id}")->assertOk()->assertJsonCount(1, 'fotos');
        foreach ($excluded as $animal) {
            $this->getJson("/api/v1/public/animais/{$animal->id}")->assertNotFound();
        }
    }

    public function test_public_filters_and_pagination(): void
    {
        $ong = $this->ong();
        for ($i = 0; $i < 16; $i++) {
            $this->animal($ong->id, ['nome' => 'Animal '.$i, 'publicado' => true, 'especie' => $i === 0 ? 'GATO' : 'CACHORRO']);
        }
        $this->getJson('/api/v1/public/animais')->assertOk()->assertJsonCount(15, 'data')->assertJsonPath('meta.total', 16);
        $this->getJson("/api/v1/public/animais?especie=GATO&sexo=MACHO&porte=MEDIO&ongId={$ong->id}&cidade=Manaus&estado=AM")
            ->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/public/animais?especie=INVALIDA')->assertStatus(400);
    }
}
