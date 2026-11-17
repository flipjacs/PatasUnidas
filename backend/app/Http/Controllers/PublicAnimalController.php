<?php

namespace App\Http\Controllers;

use App\Http\Resources\PublicAnimalResource;
use App\Models\Animal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class PublicAnimalController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'especie' => ['sometimes', Rule::in(['CACHORRO', 'GATO', 'OUTRO'])],
            'sexo' => ['sometimes', Rule::in(['MACHO', 'FEMEA', 'NAO_INFORMADO'])],
            'porte' => ['sometimes', Rule::in(['PEQUENO', 'MEDIO', 'GRANDE', 'NAO_INFORMADO'])],
            'ongId' => ['sometimes', 'integer', 'min:1'],
            'cidade' => ['sometimes', 'string', 'max:80'],
            'estado' => ['sometimes', 'string', 'size:2'],
        ]);
        $query = Animal::query()->publiclyEligible()->with(['ong:id,nome,cidade,estado', 'fotoPrincipal']);
        foreach (['especie', 'sexo', 'porte'] as $field) {
            if (isset($filters[$field])) {
                $query->where($field, $filters[$field]);
            }
        }
        if (isset($filters['ongId'])) {
            $query->where('ong_id', $filters['ongId']);
        }
        foreach (['cidade', 'estado'] as $field) {
            if (isset($filters[$field])) {
                $query->whereHas('ong', fn (Builder $ong) => $ong->where($field, $filters[$field]));
            }
        }

        return PublicAnimalResource::collection($query->orderByDesc('created_at')->orderByDesc('id')->paginate(15));
    }

    public function show(int $animal): PublicAnimalResource
    {
        return new PublicAnimalResource(Animal::query()->publiclyEligible()
            ->with(['ong:id,nome,cidade,estado', 'fotoPrincipal', 'fotos'])->findOrFail($animal));
    }
}
