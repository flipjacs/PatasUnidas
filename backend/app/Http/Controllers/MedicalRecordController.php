<?php

namespace App\Http\Controllers;

use App\Http\Requests\MedicalRecordCorrectionRequest;
use App\Http\Requests\MedicalRecordRequest;
use App\Http\Resources\MedicalRecordCorrectionResource;
use App\Http\Resources\MedicalRecordResource;
use App\Models\Animal;
use App\Models\MedicalRecord;
use App\Models\MedicalRecordCorrection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class MedicalRecordController extends Controller
{
    private function animal(Request $request, int $id): Animal
    {
        Gate::authorize('viewAny', MedicalRecord::class);

        return Animal::query()->where('ong_id', $request->user()->ong_id)->findOrFail($id);
    }

    public function store(MedicalRecordRequest $request, int $animal): JsonResponse
    {
        $recordAnimal = $this->animal($request, $animal);
        Gate::authorize('create', [MedicalRecord::class, $recordAnimal]);
        if (in_array($recordAnimal->situacao, ['ADOTADO', 'FALECIDO'], true)) {
            throw new HttpException(409, 'Animal não pode receber novos procedimentos clínicos.');
        }
        $data = $request->validated();
        $record = MedicalRecord::create([
            'animal_id' => $recordAnimal->id,
            'ong_id' => $recordAnimal->ong_id,
            'registrado_por' => $request->user()->id,
            'tipo' => $data['tipo'],
            'titulo' => $data['titulo'],
            'descricao' => $data['descricao'],
            'data_procedimento' => $data['dataProcedimento'],
            'profissional_responsavel' => $data['profissionalResponsavel'] ?? null,
            'medicamentos' => $data['medicamentos'] ?? null,
            'observacoes' => $data['observacoes'] ?? null,
        ]);

        return (new MedicalRecordResource($record->setRelation('animal', $recordAnimal)
            ->setRelation('registrador', $request->user())))->response()->setStatusCode(201);
    }

    public function index(Request $request, int $animal): AnonymousResourceCollection
    {
        $recordAnimal = $this->animal($request, $animal);
        $filters = $request->validate([
            'tipo' => ['sometimes', Rule::in(MedicalRecord::TYPES)],
            'de' => ['sometimes', 'date_format:Y-m-d'],
            'ate' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:de'],
        ]);
        $query = $recordAnimal->prontuarios()->with(['animal:id,nome', 'registrador:id,nome']);
        if (isset($filters['tipo'])) {
            $query->where('tipo', $filters['tipo']);
        }
        if (isset($filters['de'])) {
            $query->where('data_procedimento', '>=', $filters['de']);
        }
        if (isset($filters['ate'])) {
            $query->where('data_procedimento', '<=', $filters['ate']);
        }

        return MedicalRecordResource::collection($query->orderByDesc('data_procedimento')->orderByDesc('id')->paginate(15));
    }

    public function show(Request $request, int $animal, int $registro): MedicalRecordResource
    {
        $recordAnimal = $this->animal($request, $animal);
        $record = $recordAnimal->prontuarios()->with(['animal:id,nome', 'registrador:id,nome'])->findOrFail($registro);

        return new MedicalRecordResource($record);
    }

    public function correct(MedicalRecordCorrectionRequest $request, int $animal, int $registro): MedicalRecordResource
    {
        $recordAnimal = $this->animal($request, $animal);
        Gate::authorize('correct', [MedicalRecord::class, $recordAnimal]);
        $data = $request->validated();
        $fields = [
            'tipo' => 'tipo', 'titulo' => 'titulo', 'descricao' => 'descricao',
            'dataProcedimento' => 'data_procedimento',
            'profissionalResponsavel' => 'profissional_responsavel',
            'medicamentos' => 'medicamentos', 'observacoes' => 'observacoes',
        ];
        $record = DB::transaction(function () use ($recordAnimal, $registro, $request, $data, $fields): MedicalRecord {
            $record = $recordAnimal->prontuarios()->lockForUpdate()->findOrFail($registro);
            $before = $this->clinicalData($record);
            $changes = [];
            foreach ($fields as $input => $column) {
                if (array_key_exists($input, $data)) {
                    $changes[$column] = $data[$input];
                }
            }
            $record->fill($changes);
            if ($before === $this->clinicalData($record)) {
                throw ValidationException::withMessages(['campos' => 'Nenhuma informação clínica foi alterada.']);
            }
            MedicalRecordCorrection::create([
                'medical_record_id' => $record->id,
                'corrigido_por' => $request->user()->id,
                'justificativa' => $data['justificativa'],
                'dados_anteriores' => $before,
                'dados_novos' => $this->clinicalData($record),
            ]);
            $record->save();

            return $record;
        });

        return new MedicalRecordResource($record->load(['animal:id,nome', 'registrador:id,nome']));
    }

    public function corrections(Request $request, int $animal, int $registro): AnonymousResourceCollection
    {
        $recordAnimal = $this->animal($request, $animal);
        $record = $recordAnimal->prontuarios()->findOrFail($registro);

        return MedicalRecordCorrectionResource::collection($record->correcoes()
            ->with('responsavel:id,nome')->orderBy('created_at')->orderBy('id')->paginate(15));
    }

    private function clinicalData(MedicalRecord $record): array
    {
        return [
            'tipo' => $record->tipo,
            'titulo' => $record->titulo,
            'descricao' => $record->descricao,
            'dataProcedimento' => $record->data_procedimento->format('Y-m-d'),
            'profissionalResponsavel' => $record->profissional_responsavel,
            'medicamentos' => $record->medicamentos,
            'observacoes' => $record->observacoes,
        ];
    }
}
