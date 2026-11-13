<?php

namespace App\Http\Controllers;

use App\Http\Requests\AnimalRequest;
use App\Http\Requests\SituacaoAnimalRequest;
use App\Http\Resources\AnimalResource;
use App\Models\Animal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\HttpException;

class AnimalController extends Controller
{
    private function animais(Request $request): Builder
    {
        Gate::authorize('viewAny', Animal::class);

        return Animal::query()->where('ong_id', $request->user()->ong_id);
    }

    private function animal(Request $request, int $animal): Animal
    {
        $record = $this->animais($request)->findOrFail($animal);
        Gate::authorize('view', $record);

        return $record;
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'especie' => ['sometimes', Rule::in(['CACHORRO', 'GATO', 'OUTRO'])],
            'situacao' => ['sometimes', Rule::in(['DISPONIVEL', 'EM_PROCESSO_ADOCAO', 'ADOTADO', 'INDISPONIVEL', 'FALECIDO'])],
            'sexo' => ['sometimes', Rule::in(['MACHO', 'FEMEA', 'NAO_INFORMADO'])],
            'porte' => ['sometimes', Rule::in(['PEQUENO', 'MEDIO', 'GRANDE', 'NAO_INFORMADO'])],
        ]);
        $query = $this->animais($request);
        foreach ($filters as $field => $value) {
            $query->where($field, $value);
        }

        return AnimalResource::collection($query->orderBy('id')->paginate(15));
    }

    public function store(AnimalRequest $request): JsonResponse
    {
        Gate::authorize('create', Animal::class);
        $animal = Animal::create([
            ...$request->validated(),
            'ong_id' => $request->user()->ong_id,
            'situacao' => 'DISPONIVEL',
            'publicado' => false,
        ]);

        return (new AnimalResource($animal))->response()->setStatusCode(201);
    }

    public function show(Request $request, int $animal): AnimalResource
    {
        return new AnimalResource($this->animal($request, $animal));
    }

    public function update(AnimalRequest $request, int $animal): AnimalResource
    {
        $record = $this->animal($request, $animal);
        Gate::authorize('update', $record);
        $record->update($request->validated());

        return new AnimalResource($record);
    }

    public function situacao(SituacaoAnimalRequest $request, int $animal): AnimalResource
    {
        $record = $this->animal($request, $animal);
        Gate::authorize('update', $record);
        $current = $record->situacao;
        $next = $request->validated('situacao');
        $allowed = match ($current) {
            'DISPONIVEL' => ['INDISPONIVEL', 'FALECIDO'],
            'INDISPONIVEL' => ['DISPONIVEL', 'FALECIDO'],
            default => [],
        };
        if (! in_array($next, $allowed, true)) {
            throw new HttpException(409, 'Transição de situação não permitida.');
        }
        $record->update(['situacao' => $next]);

        return new AnimalResource($record);
    }

    public function publicar(Request $request, int $animal): AnimalResource
    {
        $record = $this->animal($request, $animal);
        Gate::authorize('update', $record);
        $record->update(['publicado' => true]);

        return new AnimalResource($record);
    }

    public function despublicar(Request $request, int $animal): AnimalResource
    {
        $record = $this->animal($request, $animal);
        Gate::authorize('update', $record);
        $record->update(['publicado' => false]);

        return new AnimalResource($record);
    }
}
