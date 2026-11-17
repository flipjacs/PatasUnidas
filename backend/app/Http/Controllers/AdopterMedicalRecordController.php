<?php

namespace App\Http\Controllers;

use App\Http\Resources\AdopterMedicalRecordResource;
use App\Models\Animal;
use App\Models\MedicalRecord;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class AdopterMedicalRecordController extends Controller
{
    private function adoptedAnimal(Request $request, int $animal): Animal
    {
        abort_unless($request->user()->perfil === 'usuario', 403);

        return Animal::query()->whereHas('adocao', function ($query) use ($request): void {
            $query->where('usuario_id', $request->user()->id)
                ->whereHas('solicitacao', fn ($requestQuery) => $requestQuery->where('status', 'CONCLUIDA'));
        })->findOrFail($animal);
    }

    public function index(Request $request, int $animal): AnonymousResourceCollection
    {
        $adoptedAnimal = $this->adoptedAnimal($request, $animal);
        $filters = $request->validate([
            'tipo' => ['sometimes', Rule::in(MedicalRecord::TYPES)],
            'de' => ['sometimes', 'date_format:Y-m-d'],
            'ate' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:de'],
        ]);
        $query = $adoptedAnimal->prontuarios()->with('animal:id,nome');
        if (isset($filters['tipo'])) {
            $query->where('tipo', $filters['tipo']);
        }
        if (isset($filters['de'])) {
            $query->where('data_procedimento', '>=', $filters['de']);
        }
        if (isset($filters['ate'])) {
            $query->where('data_procedimento', '<=', $filters['ate']);
        }

        return AdopterMedicalRecordResource::collection($query->orderByDesc('data_procedimento')->orderByDesc('id')->paginate(15));
    }

    public function show(Request $request, int $animal, int $registro): AdopterMedicalRecordResource
    {
        $adoptedAnimal = $this->adoptedAnimal($request, $animal);
        $record = $adoptedAnimal->prontuarios()->with('animal:id,nome')->findOrFail($registro);

        return new AdopterMedicalRecordResource($record);
    }
}
