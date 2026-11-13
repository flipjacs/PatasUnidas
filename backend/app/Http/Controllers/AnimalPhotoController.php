<?php

namespace App\Http\Controllers;

use App\Http\Resources\AnimalPhotoResource;
use App\Models\Animal;
use App\Models\AnimalPhoto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

class AnimalPhotoController extends Controller
{
    private function animal(Request $request, int $animal): Animal
    {
        Gate::authorize('viewAny', Animal::class);

        $record = Animal::query()->where('ong_id', $request->user()->ong_id)->findOrFail($animal);
        Gate::authorize('view', $record);

        return $record;
    }

    private function foto(Animal $animal, int $foto): AnimalPhoto
    {
        return $animal->fotos()->findOrFail($foto);
    }

    public function index(Request $request, int $animal): AnonymousResourceCollection
    {
        return AnimalPhotoResource::collection($this->animal($request, $animal)->fotos()->orderBy('id')->get());
    }

    public function store(Request $request, int $animal): JsonResponse
    {
        $record = $this->animal($request, $animal);
        Gate::authorize('update', $record);
        $request->validate(['foto' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120']]);
        if (array_diff(array_keys($request->all()), ['foto'])) {
            throw new HttpException(400, 'Campo não permitido.');
        }

        $path = null;
        try {
            $foto = DB::transaction(function () use ($request, $record, &$path): AnimalPhoto {
                Animal::query()->whereKey($record->id)->lockForUpdate()->firstOrFail();
                $count = $record->fotos()->count();
                if ($count >= 8) {
                    throw new HttpException(409, 'Limite de oito fotografias atingido.');
                }
                $path = $request->file('foto')->store("animais/{$record->id}", 'public');
                if (! $path) {
                    throw new HttpException(500, 'Não foi possível armazenar a fotografia.');
                }

                return $record->fotos()->create(['caminho' => $path, 'principal' => $count === 0]);
            });
        } catch (\Throwable $error) {
            if ($path) {
                Storage::disk('public')->delete($path);
            }
            throw $error;
        }

        return (new AnimalPhotoResource($foto))->response()->setStatusCode(201);
    }

    public function principal(Request $request, int $animal, int $foto): AnimalPhotoResource
    {
        $record = $this->animal($request, $animal);
        Gate::authorize('update', $record);
        $target = DB::transaction(function () use ($record, $foto): AnimalPhoto {
            Animal::query()->whereKey($record->id)->lockForUpdate()->firstOrFail();
            $target = $this->foto($record, $foto);
            if (! $target->principal) {
                $record->fotos()->where('principal', true)->update(['principal' => false]);
                $target->update(['principal' => true]);
            }

            return $target;
        });

        return new AnimalPhotoResource($target);
    }

    public function destroy(Request $request, int $animal, int $foto): JsonResponse
    {
        $record = $this->animal($request, $animal);
        Gate::authorize('update', $record);
        $target = $this->foto($record, $foto);
        $disk = Storage::disk('public');
        $trash = 'animais/.trash/'.Str::uuid();
        if (! $disk->move($target->caminho, $trash)) {
            throw new HttpException(500, 'Não foi possível remover a fotografia.');
        }

        try {
            DB::transaction(function () use ($record, $target): void {
                Animal::query()->whereKey($record->id)->lockForUpdate()->firstOrFail();
                $wasPrincipal = $target->principal;
                $target->delete();
                if ($wasPrincipal) {
                    $next = $record->fotos()->orderBy('id')->first();
                    $next?->update(['principal' => true]);
                }
            });
        } catch (\Throwable $error) {
            $disk->move($trash, $target->caminho);
            throw $error;
        }
        if (! $disk->delete($trash)) {
            Log::warning('Falha ao limpar arquivo de fotografia removida.', ['foto_id' => $target->id]);
        }

        return response()->json(['message' => 'Fotografia removida.']);
    }
}
