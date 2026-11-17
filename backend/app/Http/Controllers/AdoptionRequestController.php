<?php

namespace App\Http\Controllers;

use App\Http\Requests\CadastroAdocaoRequest;
use App\Http\Requests\CancelamentoAprovacaoRequest;
use App\Http\Requests\RejeicaoAdocaoRequest;
use App\Http\Resources\InternalAdoptionRequestResource;
use App\Http\Resources\OwnAdoptionRequestResource;
use App\Models\Adoption;
use App\Models\AdoptionRequest;
use App\Models\Animal;
use App\Services\SponsorshipClosureService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\HttpException;

class AdoptionRequestController extends Controller
{
    private function own(Request $request): Builder
    {
        Gate::authorize('viewOwn', AdoptionRequest::class);

        return AdoptionRequest::query()->where('usuario_id', $request->user()->id);
    }

    private function internal(Request $request): Builder
    {
        Gate::authorize('viewInternal', AdoptionRequest::class);

        return AdoptionRequest::query()->where('ong_id', $request->user()->ong_id);
    }

    private function withDetails(Builder $query): Builder
    {
        return $query->with(['animal:id,nome', 'ong:id,nome', 'solicitante:id,nome,email',
            'analisador:id,nome', 'cancelador:id,nome', 'adocao:id,adoption_request_id,data_entrega']);
    }

    private function lockedTransition(Request $request, int $id, bool $own): array
    {
        $scope = $own ? $this->own($request) : $this->internal($request);
        $animalId = (clone $scope)->whereKey($id)->firstOrFail(['animal_id'])->animal_id;
        $animal = Animal::query()->whereKey($animalId)->lockForUpdate()->firstOrFail();
        $solicitacao = $scope->where('animal_id', $animal->id)->lockForUpdate()->findOrFail($id);

        return [$animal, $solicitacao];
    }

    private function completionExists(Animal $animal): bool
    {
        return Adoption::query()->where('animal_id', $animal->id)->exists();
    }

    private function validApproved(Animal $animal, AdoptionRequest $solicitacao): bool
    {
        return $solicitacao->status === 'APROVADA' && $animal->situacao === 'EM_PROCESSO_ADOCAO'
            && $animal->ong_id === $solicitacao->ong_id && ! $this->completionExists($animal);
    }

    public function store(CadastroAdocaoRequest $request): JsonResponse
    {
        Gate::authorize('create', AdoptionRequest::class);
        $data = $request->validated();
        $solicitacao = DB::transaction(function () use ($request, $data): AdoptionRequest {
            $animal = Animal::query()->whereKey($data['animalId'])->lockForUpdate()->firstOrFail();
            if (! $animal->publicado || $animal->situacao !== 'DISPONIVEL'
                || ! $animal->ong()->where('status', 'ATIVA')->exists()) {
                throw new HttpException(409, 'Animal indisponível para solicitação de adoção.');
            }
            if (AdoptionRequest::query()->where('animal_id', $animal->id)
                ->where('usuario_id', $request->user()->id)->where('status', 'PENDENTE')->exists()) {
                throw new HttpException(409, 'Já existe uma solicitação pendente para este animal.');
            }

            return AdoptionRequest::create([
                'animal_id' => $animal->id,
                'usuario_id' => $request->user()->id,
                'ong_id' => $animal->ong_id,
                'status' => 'PENDENTE',
                'mensagem' => $data['mensagem'] ?? null,
            ]);
        });

        return (new OwnAdoptionRequestResource($solicitacao->load(['animal:id,nome', 'ong:id,nome'])))->response()->setStatusCode(201);
    }

    public function mine(Request $request): AnonymousResourceCollection
    {
        return OwnAdoptionRequestResource::collection($this->own($request)
            ->with(['animal:id,nome', 'ong:id,nome', 'adocao:id,adoption_request_id,data_entrega'])
            ->orderByDesc('created_at')->orderByDesc('id')->paginate(15));
    }

    public function cancel(Request $request, int $solicitacao): OwnAdoptionRequestResource
    {
        $record = DB::transaction(function () use ($request, $solicitacao): AdoptionRequest {
            [$animal, $record] = $this->lockedTransition($request, $solicitacao, true);
            Gate::authorize('cancel', $record);
            if ($record->status === 'APROVADA' && $this->validApproved($animal, $record)) {
                $animal->update(['situacao' => 'DISPONIVEL']);
            } elseif ($record->status !== 'PENDENTE') {
                throw new HttpException(409, 'Esta solicitação não pode ser cancelada.');
            }
            $record->update(['status' => 'CANCELADA', 'cancelado_por' => $request->user()->id, 'cancelado_em' => now()]);

            return $record;
        });

        return new OwnAdoptionRequestResource($record->load(['animal:id,nome', 'ong:id,nome', 'adocao:id,adoption_request_id,data_entrega']));
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'status' => ['sometimes', Rule::in(['PENDENTE', 'APROVADA', 'REJEITADA', 'CANCELADA', 'CONCLUIDA'])],
            'animalId' => ['sometimes', 'integer', 'min:1'],
        ]);
        $query = $this->withDetails($this->internal($request));
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (isset($filters['animalId'])) {
            $query->where('animal_id', $filters['animalId']);
        }

        return InternalAdoptionRequestResource::collection($query->orderByDesc('created_at')->orderByDesc('id')->paginate(15));
    }

    public function show(Request $request, int $solicitacao): InternalAdoptionRequestResource
    {
        return new InternalAdoptionRequestResource($this->withDetails($this->internal($request))->findOrFail($solicitacao));
    }

    public function reject(RejeicaoAdocaoRequest $request, int $solicitacao): InternalAdoptionRequestResource
    {
        $record = DB::transaction(function () use ($request, $solicitacao): AdoptionRequest {
            $record = $this->internal($request)->lockForUpdate()->findOrFail($solicitacao);
            Gate::authorize('reject', $record);
            if ($record->status !== 'PENDENTE') {
                throw new HttpException(409, 'Esta solicitação não pode ser rejeitada.');
            }
            $record->update([
                'status' => 'REJEITADA',
                'justificativa_rejeicao' => $request->validated('justificativa'),
                'analisado_por' => $request->user()->id,
                'analisado_em' => now(),
            ]);

            return $record;
        });

        return new InternalAdoptionRequestResource($record->load(['animal:id,nome', 'ong:id,nome', 'solicitante:id,nome,email', 'analisador:id,nome', 'cancelador:id,nome', 'adocao:id,adoption_request_id,data_entrega']));
    }

    public function approve(Request $request, int $solicitacao): InternalAdoptionRequestResource
    {
        $record = DB::transaction(function () use ($request, $solicitacao): AdoptionRequest {
            [$animal, $record] = $this->lockedTransition($request, $solicitacao, false);
            Gate::authorize('approve', $record);
            if ($record->status !== 'PENDENTE' || $animal->ong_id !== $record->ong_id
                || $animal->situacao !== 'DISPONIVEL' || ! $animal->publicado
                || $this->completionExists($animal)
                || AdoptionRequest::query()->where('animal_id', $animal->id)->where('status', 'APROVADA')->exists()) {
                throw new HttpException(409, 'Solicitação ou animal indisponível para aprovação.');
            }
            $record->update(['status' => 'APROVADA', 'analisado_por' => $request->user()->id, 'analisado_em' => now()]);
            $animal->update(['situacao' => 'EM_PROCESSO_ADOCAO']);

            return $record;
        });

        return new InternalAdoptionRequestResource($record->load(['animal:id,nome', 'ong:id,nome', 'solicitante:id,nome,email', 'analisador:id,nome', 'cancelador:id,nome', 'adocao:id,adoption_request_id,data_entrega']));
    }

    public function cancelApproval(CancelamentoAprovacaoRequest $request, int $solicitacao): InternalAdoptionRequestResource
    {
        $record = DB::transaction(function () use ($request, $solicitacao): AdoptionRequest {
            [$animal, $record] = $this->lockedTransition($request, $solicitacao, false);
            Gate::authorize('cancelApproval', $record);
            if (! $this->validApproved($animal, $record)) {
                throw new HttpException(409, 'Esta aprovação não pode ser cancelada.');
            }
            $record->update([
                'status' => 'CANCELADA',
                'justificativa_cancelamento' => $request->validated('justificativa'),
                'cancelado_por' => $request->user()->id,
                'cancelado_em' => now(),
            ]);
            $animal->update(['situacao' => 'DISPONIVEL']);

            return $record;
        });

        return new InternalAdoptionRequestResource($record->load(['animal:id,nome', 'ong:id,nome', 'solicitante:id,nome,email', 'analisador:id,nome', 'cancelador:id,nome', 'adocao:id,adoption_request_id,data_entrega']));
    }

    public function confirmDelivery(Request $request, int $solicitacao): InternalAdoptionRequestResource
    {
        $record = DB::transaction(function () use ($request, $solicitacao): AdoptionRequest {
            [$animal, $record] = $this->lockedTransition($request, $solicitacao, false);
            Gate::authorize('confirmDelivery', $record);
            if (! $this->validApproved($animal, $record)) {
                throw new HttpException(409, 'Entrega não pode ser confirmada neste estado.');
            }
            Adoption::create([
                'adoption_request_id' => $record->id,
                'animal_id' => $animal->id,
                'usuario_id' => $record->usuario_id,
                'ong_id' => $record->ong_id,
                'confirmado_por' => $request->user()->id,
                'data_entrega' => now(),
            ]);
            $record->update(['status' => 'CONCLUIDA']);
            $animal->update(['situacao' => 'ADOTADO']);
            app(SponsorshipClosureService::class)->closeForAnimal($animal, 'ADOCAO_CONCLUIDA', CarbonImmutable::now());
            AdoptionRequest::query()->where('animal_id', $animal->id)->where('status', 'PENDENTE')->update([
                'status' => 'REJEITADA',
                'justificativa_rejeicao' => 'Animal adotado por outro solicitante.',
                'analisado_por' => $request->user()->id,
                'analisado_em' => now(),
                'updated_at' => now(),
            ]);

            return $record;
        });

        return new InternalAdoptionRequestResource($record->load(['animal:id,nome', 'ong:id,nome', 'solicitante:id,nome,email', 'analisador:id,nome', 'cancelador:id,nome', 'adocao:id,adoption_request_id,data_entrega']));
    }
}
