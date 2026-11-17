<?php

namespace App\Http\Controllers;

use App\Http\Requests\CadastroSponsorshipRequest;
use App\Http\Requests\EncerrarSponsorshipRequest;
use App\Http\Resources\InternalSponsorshipResource;
use App\Http\Resources\SponsorshipInstallmentResource;
use App\Http\Resources\SponsorshipResource;
use App\Models\Animal;
use App\Models\Donation;
use App\Models\FinancialTransaction;
use App\Models\Ong;
use App\Models\Sponsorship;
use App\Services\SponsorshipInstallmentGenerator;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class SponsorshipController extends Controller
{
    private function own(Request $request): Builder
    {
        Gate::authorize('viewOwn', Sponsorship::class);

        return Sponsorship::query()->where('usuario_id', $request->user()->id);
    }

    private function internal(Request $request): Builder
    {
        Gate::authorize('viewInternal', Sponsorship::class);

        return Sponsorship::query()->where('ong_id', $request->user()->ong_id);
    }

    private function details(Builder $query, bool $internal = false): Builder
    {
        $relations = ['animal:id,nome', 'ong:id,nome'];
        if ($internal) {
            $relations[] = 'usuario:id,nome,email';
        }

        return $query->with($relations)->withMin([
            'parcelas as proximo_vencimento' => fn (Builder $installments) => $installments->where('status', 'PENDENTE'),
        ], 'vencimento');
    }

    private function generateDue(Builder $scope, int $id): Sponsorship
    {
        $record = (clone $scope)->findOrFail($id);
        if ($record->modalidade !== 'MENSAL' || $record->status !== 'ATIVO') {
            return $record;
        }

        return DB::transaction(function () use ($scope, $id): Sponsorship {
            $record = $scope->lockForUpdate()->findOrFail($id);
            app(SponsorshipInstallmentGenerator::class)->ensureDue($record);

            return $record;
        });
    }

    public function store(CadastroSponsorshipRequest $request): JsonResponse
    {
        Gate::authorize('create', Sponsorship::class);
        $data = $request->validated();
        $record = DB::transaction(function () use ($request, $data): Sponsorship {
            $animal = Animal::query()->whereKey($data['animalId'])->lockForUpdate()->firstOrFail();
            $ong = Ong::query()->whereKey($animal->ong_id)->lockForUpdate()->firstOrFail();
            if (! $animal->publicado || ! in_array($animal->situacao, ['DISPONIVEL', 'EM_PROCESSO_ADOCAO'], true)
                || $ong->status !== 'ATIVA') {
                throw new HttpException(409, 'Animal indisponível para apadrinhamento.');
            }
            if (Sponsorship::query()->where('usuario_id', $request->user()->id)
                ->where('animal_id', $animal->id)->where('modalidade', $data['modalidade'])
                ->where('status', 'ATIVO')->exists()) {
                throw new HttpException(409, 'Apadrinhamento ativo já existente para este animal e modalidade.');
            }

            $start = today()->toDateString();
            $sponsorship = Sponsorship::create([
                'animal_id' => $animal->id,
                'ong_id' => $animal->ong_id,
                'usuario_id' => $request->user()->id,
                'modalidade' => $data['modalidade'],
                'valor' => $data['valor'],
                'status' => 'ATIVO',
                'data_inicio' => $start,
            ]);
            $sponsorship->parcelas()->create([
                'numero' => 1,
                'valor' => $data['valor'],
                'vencimento' => $start,
                'status' => 'PENDENTE',
            ]);

            return $sponsorship;
        });

        return (new SponsorshipResource($this->details($record->newQuery())->with('primeiraParcela')
            ->findOrFail($record->id)))->response()->setStatusCode(201);
    }

    public function mine(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate(['status' => ['sometimes', Rule::in(['ATIVO', 'ENCERRADO'])]]);
        $query = $this->details($this->own($request));
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return SponsorshipResource::collection($query->orderByDesc('created_at')->orderByDesc('id')->paginate(15));
    }

    public function showOwn(Request $request, int $apadrinhamento): SponsorshipResource
    {
        $this->generateDue($this->own($request), $apadrinhamento);

        return new SponsorshipResource($this->details($this->own($request))->findOrFail($apadrinhamento));
    }

    public function ownInstallments(Request $request, int $apadrinhamento): AnonymousResourceCollection
    {
        $filters = $request->validate(['status' => ['sometimes', Rule::in(['PENDENTE', 'CONFIRMADA', 'CANCELADA'])]]);
        $record = $this->generateDue($this->own($request), $apadrinhamento);
        $query = $record->parcelas();
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return SponsorshipInstallmentResource::collection($query->orderBy('vencimento')->orderBy('numero')->paginate(15));
    }

    public function cancel(Request $request, int $apadrinhamento): SponsorshipResource
    {
        if ($request->all() !== []) {
            throw ValidationException::withMessages(['payload' => 'Campos não permitidos.']);
        }
        DB::transaction(function () use ($request, $apadrinhamento): void {
            $record = $this->own($request)->lockForUpdate()->findOrFail($apadrinhamento);
            if ($record->status !== 'ATIVO') {
                throw new HttpException(409, 'Apadrinhamento já encerrado.');
            }
            app(SponsorshipInstallmentGenerator::class)->ensureDue($record);
            $record->update([
                'status' => 'ENCERRADO',
                'data_encerramento' => today()->toDateString(),
                'motivo_encerramento' => 'CANCELAMENTO_USUARIO',
            ]);
        });

        return new SponsorshipResource($this->details($this->own($request))->findOrFail($apadrinhamento));
    }

    public function indexInternal(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'animalId' => ['sometimes', 'integer', 'min:1'],
            'modalidade' => ['sometimes', Rule::in(['UNICO', 'MENSAL'])],
            'status' => ['sometimes', Rule::in(['ATIVO', 'ENCERRADO'])],
        ]);
        $query = $this->details($this->internal($request), true);
        if (isset($filters['animalId'])) {
            $query->where('animal_id', $filters['animalId']);
        }
        foreach (['modalidade', 'status'] as $field) {
            if (isset($filters[$field])) {
                $query->where($field, $filters[$field]);
            }
        }

        return InternalSponsorshipResource::collection($query->orderByDesc('created_at')->orderByDesc('id')->paginate(15));
    }

    public function showInternal(Request $request, int $apadrinhamento): InternalSponsorshipResource
    {
        $this->generateDue($this->internal($request), $apadrinhamento);

        return new InternalSponsorshipResource($this->details($this->internal($request), true)->findOrFail($apadrinhamento));
    }

    public function internalInstallments(Request $request, int $apadrinhamento): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'status' => ['sometimes', Rule::in(['PENDENTE', 'CONFIRMADA', 'CANCELADA'])],
            'vencidas' => ['sometimes', 'boolean'],
            'de' => ['sometimes', 'date_format:Y-m-d'],
            'ate' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:de'],
        ]);
        $record = $this->generateDue($this->internal($request), $apadrinhamento);
        $query = $record->parcelas()->with('confirmador:id,nome');
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (isset($filters['vencidas'])) {
            if ((bool) $filters['vencidas']) {
                $query->where('status', 'PENDENTE')->where('vencimento', '<', today()->toDateString());
            } else {
                $query->where(fn (Builder $installments) => $installments
                    ->where('status', '!=', 'PENDENTE')->orWhere('vencimento', '>=', today()->toDateString()));
            }
        }
        if (isset($filters['de'])) {
            $query->where('vencimento', '>=', $filters['de']);
        }
        if (isset($filters['ate'])) {
            $query->where('vencimento', '<', CarbonImmutable::parse($filters['ate'])->addDay()->toDateString());
        }

        return SponsorshipInstallmentResource::collection($query->orderBy('vencimento')->orderBy('numero')->paginate(15));
    }

    public function confirmInstallment(Request $request, int $apadrinhamento, int $parcela): SponsorshipInstallmentResource
    {
        Gate::authorize('confirmInstallment', Sponsorship::class);
        if ($request->all() !== []) {
            throw ValidationException::withMessages(['payload' => 'Campos não permitidos.']);
        }

        $installment = DB::transaction(function () use ($request, $apadrinhamento, $parcela) {
            $sponsorship = $this->internal($request)->lockForUpdate()->findOrFail($apadrinhamento);
            $installment = $sponsorship->parcelas()->lockForUpdate()->findOrFail($parcela);
            if ($installment->status !== 'PENDENTE' || ! preg_match(Donation::AMOUNT_PATTERN, $installment->valor)
                || FinancialTransaction::query()->where('origem_tipo', 'APADRINHAMENTO')
                    ->where('origem_id', $installment->id)->exists()
                || ($sponsorship->status === 'ENCERRADO' && $sponsorship->data_encerramento !== null
                    && $installment->created_at->toDateString() > $sponsorship->data_encerramento->toDateString()
                    && $installment->vencimento->isAfter($sponsorship->data_encerramento))) {
                throw new HttpException(409, 'Parcela indisponível para confirmação.');
            }

            $confirmedAt = now();
            $installment->update([
                'status' => 'CONFIRMADA',
                'confirmado_por' => $request->user()->id,
                'confirmado_em' => $confirmedAt,
            ]);
            FinancialTransaction::create([
                'ong_id' => $sponsorship->ong_id,
                'tipo' => 'RECEITA',
                'categoria' => 'APADRINHAMENTO',
                'descricao' => 'Parcela de apadrinhamento recebida',
                'valor' => $installment->valor,
                'status' => 'REALIZADA',
                'origem_tipo' => 'APADRINHAMENTO',
                'origem_id' => $installment->id,
                'registrado_por' => $request->user()->id,
                'confirmado_por' => $request->user()->id,
                'confirmado_em' => $confirmedAt,
            ]);

            return $installment;
        });

        return new SponsorshipInstallmentResource($installment->load('confirmador:id,nome'));
    }

    public function closeInternal(EncerrarSponsorshipRequest $request, int $apadrinhamento): InternalSponsorshipResource
    {
        Gate::authorize('closeInternal', Sponsorship::class);
        DB::transaction(function () use ($request, $apadrinhamento): void {
            $record = $this->internal($request)->lockForUpdate()->findOrFail($apadrinhamento);
            if ($record->status !== 'ATIVO') {
                throw new HttpException(409, 'Apadrinhamento já encerrado.');
            }
            app(SponsorshipInstallmentGenerator::class)->ensureDue($record);
            $record->update([
                'status' => 'ENCERRADO',
                'data_encerramento' => today()->toDateString(),
                'motivo_encerramento' => 'ENCERRAMENTO_ONG',
                'justificativa_encerramento' => $request->validated('justificativa'),
            ]);
        });

        return new InternalSponsorshipResource($this->details($this->internal($request), true)->findOrFail($apadrinhamento));
    }
}
