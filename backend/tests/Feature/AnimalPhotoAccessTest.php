<?php

namespace Tests\Feature;

use App\Models\Animal;
use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AnimalPhotoAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://127.0.0.1:5174');
        Storage::fake('local');
        Storage::fake('public');
    }

    private function ong(string $status = 'ATIVA'): Ong
    {
        return Ong::create(['nome' => 'ONG Teste', 'email' => uniqid().'@example.org', 'status' => $status]);
    }

    private function animal(Ong $ong, array $extra = []): Animal
    {
        return Animal::create([
            'ong_id' => $ong->id, 'nome' => 'Thor', 'especie' => 'CACHORRO',
            'sexo' => 'MACHO', 'porte' => 'MEDIO', 'idade_aproximada' => 36,
            'situacao' => 'DISPONIVEL', 'publicado' => true, ...$extra,
        ]);
    }

    private function user(string $perfil, ?int $ongId, bool $ativo = true): Usuario
    {
        return Usuario::create([
            'nome' => 'Pessoa', 'email' => uniqid().'@example.org',
            'senha_hash' => Hash::make('SenhaForte123!'), 'perfil' => $perfil,
            'ong_id' => $ongId, 'ativo' => $ativo,
        ]);
    }

    private function photo(Animal $animal): int
    {
        $photo = $animal->fotos()->create(['caminho' => "animais/{$animal->id}/foto.png", 'principal' => true]);
        Storage::disk('local')->put($photo->caminho, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9KkxQAAAAASUVORK5CYII='));

        return $photo->id;
    }

    public function test_public_photo_requires_current_catalog_eligibility(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong);
        $foto = $this->photo($animal);
        $url = "/api/v1/public/animais/{$animal->id}/fotos/{$foto}/arquivo";

        $this->get($url)->assertOk()->assertHeader('Content-Type', 'image/png');
        $animal->update(['publicado' => false]);
        $this->get($url)->assertNotFound();
        $animal->update(['publicado' => true, 'situacao' => 'INDISPONIVEL']);
        $this->get($url)->assertNotFound();
        $animal->update(['situacao' => 'DISPONIVEL']);
        $this->get($url)->assertOk();
        $ong->update(['status' => 'SUSPENSA']);
        $this->get($url)->assertNotFound();
    }

    public function test_public_photo_rejects_other_states_foreign_photo_and_missing_file(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong);
        $foto = $this->photo($animal);
        $url = "/api/v1/public/animais/{$animal->id}/fotos/{$foto}/arquivo";
        foreach (['EM_PROCESSO_ADOCAO', 'ADOTADO', 'FALECIDO'] as $situacao) {
            $animal->update(['situacao' => $situacao]);
            $this->get($url)->assertNotFound();
        }
        $animal->update(['situacao' => 'DISPONIVEL']);
        $other = $this->animal($ong);
        $this->get("/api/v1/public/animais/{$other->id}/fotos/{$foto}/arquivo")->assertNotFound();
        $this->get("/api/v1/public/animais/{$animal->id}/fotos/999999/arquivo")->assertNotFound();
        Storage::disk('local')->delete("animais/{$animal->id}/foto.png");
        $this->get($url)->assertNotFound();
    }

    public static function authorizedRoles(): array
    {
        return [['administrador'], ['voluntario'], ['veterinario']];
    }

    #[DataProvider('authorizedRoles')]
    public function test_authorized_ong_staff_can_read_unpublished_or_adopted_photo(string $perfil): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong, ['publicado' => false, 'situacao' => 'ADOTADO']);
        $foto = $this->photo($animal);
        $url = "/api/v1/ong/animais/{$animal->id}/fotos/{$foto}/arquivo";

        $this->actingAs($this->user($perfil, $ong->id))->get($url)->assertOk();
    }

    public function test_internal_photo_requires_authentication(): void
    {
        $animal = $this->animal($this->ong());
        $foto = $this->photo($animal);
        $this->get("/api/v1/ong/animais/{$animal->id}/fotos/{$foto}/arquivo")->assertUnauthorized();
    }

    public function test_public_user_cannot_read_internal_photo(): void
    {
        $animal = $this->animal($this->ong());
        $foto = $this->photo($animal);
        $this->actingAs($this->user('usuario', null))
            ->get("/api/v1/ong/animais/{$animal->id}/fotos/{$foto}/arquivo")->assertNotFound();
    }

    public function test_other_ong_cannot_read_internal_photo(): void
    {
        $animal = $this->animal($this->ong());
        $foto = $this->photo($animal);
        $this->actingAs($this->user('administrador', $this->ong()->id))
            ->get("/api/v1/ong/animais/{$animal->id}/fotos/{$foto}/arquivo")->assertNotFound();
    }

    public function test_inactive_staff_cannot_read_internal_photo(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong);
        $foto = $this->photo($animal);
        $this->actingAs($this->user('administrador', $ong->id, false))
            ->get("/api/v1/ong/animais/{$animal->id}/fotos/{$foto}/arquivo")->assertUnauthorized();
    }

    public function test_suspended_ong_blocks_internal_photo(): void
    {
        $ong = $this->ong('SUSPENSA');
        $animal = $this->animal($ong);
        $foto = $this->photo($animal);
        $this->actingAs($this->user('administrador', $ong->id))
            ->get("/api/v1/ong/animais/{$animal->id}/fotos/{$foto}/arquivo")->assertForbidden();
    }

    public function test_upload_is_private_and_catalog_and_internal_resources_have_distinct_urls(): void
    {
        $ong = $this->ong();
        $animal = $this->animal($ong);
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9KkxQAAAAASUVORK5CYII=');
        $this->actingAs($this->user('administrador', $ong->id));
        $response = $this->post("/api/v1/ong/animais/{$animal->id}/fotos", [
            'foto' => UploadedFile::fake()->createWithContent('foto.png', $png),
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('principal', true);
        $photo = $animal->fotos()->firstOrFail();
        Storage::disk('local')->assertExists($photo->caminho);
        Storage::disk('public')->assertMissing($photo->caminho);
        $this->assertStringContainsString("/api/v1/ong/animais/{$animal->id}/fotos/{$photo->id}/arquivo", $response->json('url'));
        $public = $this->getJson("/api/v1/public/animais/{$animal->id}")->assertOk();
        $this->assertStringContainsString("/api/v1/public/animais/{$animal->id}/fotos/{$photo->id}/arquivo", $public->json('fotoPrincipal.url'));
        $catalog = $this->getJson('/api/v1/public/animais')->assertOk();
        $this->assertStringContainsString("/api/v1/public/animais/{$animal->id}/fotos/{$photo->id}/arquivo", $catalog->json('data.0.fotoPrincipal.url'));
    }

    public function test_migration_command_preserves_ids_and_is_safe_to_repeat(): void
    {
        $animal = $this->animal($this->ong());
        $photo = $animal->fotos()->create(['caminho' => "animais/{$animal->id}/foto.png", 'principal' => true]);
        Storage::disk('public')->put($photo->caminho, 'legacy image bytes');

        $this->artisan('patas-unidas:migrar-fotos-privadas')->assertExitCode(0);
        Storage::disk('local')->assertExists($photo->caminho);
        Storage::disk('public')->assertMissing($photo->caminho);
        $this->assertSame('legacy image bytes', Storage::disk('local')->get($photo->caminho));
        $this->assertSame($photo->id, $photo->fresh()->id);
        $this->artisan('patas-unidas:migrar-fotos-privadas')->assertExitCode(0);
        Storage::disk('local')->assertExists($photo->caminho);
    }

    public function test_migration_command_keeps_conflicting_public_file_for_review(): void
    {
        $animal = $this->animal($this->ong());
        $photo = $animal->fotos()->create(['caminho' => "animais/{$animal->id}/foto.png", 'principal' => true]);
        Storage::disk('public')->put($photo->caminho, 'old bytes');
        Storage::disk('local')->put($photo->caminho, 'other bytes');

        $this->artisan('patas-unidas:migrar-fotos-privadas')->assertExitCode(1);
        $this->assertSame('old bytes', Storage::disk('public')->get($photo->caminho));
        $this->assertSame('other bytes', Storage::disk('local')->get($photo->caminho));
    }

    public function test_migration_command_cleans_matching_old_copy_without_changing_private_file(): void
    {
        $animal = $this->animal($this->ong());
        $photo = $animal->fotos()->create(['caminho' => "animais/{$animal->id}/foto.png", 'principal' => true]);
        Storage::disk('public')->put($photo->caminho, 'same bytes');
        Storage::disk('local')->put($photo->caminho, 'same bytes');

        $this->artisan('patas-unidas:migrar-fotos-privadas')->assertExitCode(0);
        Storage::disk('public')->assertMissing($photo->caminho);
        $this->assertSame('same bytes', Storage::disk('local')->get($photo->caminho));
    }

    public function test_migration_command_reports_missing_file_without_changing_record(): void
    {
        $animal = $this->animal($this->ong());
        $photo = $animal->fotos()->create(['caminho' => "animais/{$animal->id}/ausente.png", 'principal' => true]);

        $this->artisan('patas-unidas:migrar-fotos-privadas')->assertExitCode(1);
        $this->assertDatabaseHas('animal_photos', ['id' => $photo->id, 'caminho' => $photo->caminho]);
    }

    public function test_migration_command_reports_unlinked_public_file_without_removing_it(): void
    {
        Storage::disk('public')->put('animais/999/orfa.png', 'orphan bytes');

        $this->artisan('patas-unidas:migrar-fotos-privadas')->assertExitCode(1);
        Storage::disk('public')->assertExists('animais/999/orfa.png');
    }
}
