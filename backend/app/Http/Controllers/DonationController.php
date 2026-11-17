<?php

namespace App\Http\Controllers;

use App\Http\Requests\CadastroDoacaoRequest;
use App\Http\Resources\InternalDonationResource;
use App\Http\Resources\OwnDonationResource;
use App\Models\Donation;
use App\Models\FinancialTransaction;
use App\Models\Ong;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\HttpException;

class DonationController extends Controller
{
    private function own(Request $request): Builder
    {
        Gate::authorize('viewOwn', Donation::class);

        return Donation::query()->where('usuario_id', $request->user()->id);
    }

    private function internal(Request $request): Builder
    {
        Gate::authorize('viewInternal', Donation::class);

        return Donation::query()->where('ong_id', $request->user()->ong_id);
    }

    private function withDetails(Builder $query): Builder
    {
        return $query->with(['ong:id,nome', 'doador:id,nome', 'confirmador:id,nome', 'cancelador:id,nome']);
    }

    public function store(CadastroDoacaoRequest $request): JsonResponse
    {
        Gate::authorize('create', Donation::class);
        $data = $request->validated();
        $ong = Ong::query()->findOrFail($data['ongId']);
        if ($ong->status !== 'ATIVA') {
            throw new HttpException(409, 'ONG indisponível para doações.');
        }

        $donation = Donation::create([
            'ong_id' => $ong->id,
            'usuario_id' => $request->user()->id,
            'valor' => $data['valor'],
            'status' => 'PENDENTE',
            'mensagem' => $data['mensagem'] ?? null,
        ]);

        return (new OwnDonationResource($donation->setRelation('ong', $ong)))->response()->setStatusCode(201);
    }

    public function mine(Request $request): AnonymousResourceCollection
    {
        return OwnDonationResource::collection($this->own($request)->with('ong:id,nome')
            ->orderByDesc('created_at')->orderByDesc('id')->paginate(15));
    }

    public function cancelOwn(Request $request, int $doacao): OwnDonationResource
    {
        $donation = DB::transaction(function () use ($request, $doacao): Donation {
            $donation = $this->own($request)->lockForUpdate()->findOrFail($doacao);
            Gate::authorize('cancelOwn', $donation);
            if ($donation->status !== 'PENDENTE' || FinancialTransaction::query()
                ->where('origem_tipo', 'DOACAO')->where('origem_id', $donation->id)->exists()) {
                throw new HttpException(409, 'Esta doação não pode ser cancelada.');
            }
            $donation->update(['status' => 'CANCELADA', 'cancelado_em' => now(), 'cancelado_por' => $request->user()->id]);

            return $donation;
        });

        return new OwnDonationResource($donation->load('ong:id,nome'));
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'status' => ['sometimes', Rule::in(['PENDENTE', 'CONFIRMADA', 'CANCELADA'])],
            'de' => ['sometimes', 'date_format:Y-m-d'],
            'ate' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:de'],
        ]);
        $query = $this->withDetails($this->internal($request));
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (isset($filters['de'])) {
            $query->where('created_at', '>=', $filters['de'].' 00:00:00');
        }
        if (isset($filters['ate'])) {
            $query->where('created_at', '<', Carbon::parse($filters['ate'])->addDay()->toDateString().' 00:00:00');
        }

        return InternalDonationResource::collection($query->orderByDesc('created_at')->orderByDesc('id')->paginate(15));
    }

    public function show(Request $request, int $doacao): InternalDonationResource
    {
        return new InternalDonationResource($this->withDetails($this->internal($request))->findOrFail($doacao));
    }

    public function confirm(Request $request, int $doacao): InternalDonationResource
    {
        $donation = DB::transaction(function () use ($request, $doacao): Donation {
            $donation = $this->internal($request)->lockForUpdate()->findOrFail($doacao);
            Gate::authorize('confirm', $donation);
            if ($donation->status !== 'PENDENTE' || ! preg_match(Donation::AMOUNT_PATTERN, $donation->valor)
                || FinancialTransaction::query()->where('origem_tipo', 'DOACAO')->where('origem_id', $donation->id)->exists()) {
                throw new HttpException(409, 'Doação indisponível para confirmação.');
            }
            $confirmedAt = now();
            $donation->update(['status' => 'CONFIRMADA', 'confirmado_por' => $request->user()->id, 'confirmado_em' => $confirmedAt]);
            FinancialTransaction::create([
                'ong_id' => $donation->ong_id,
                'tipo' => 'RECEITA',
                'categoria' => 'DOACAO',
                'descricao' => 'Doação recebida',
                'valor' => $donation->valor,
                'status' => 'REALIZADA',
                'origem_tipo' => 'DOACAO',
                'origem_id' => $donation->id,
                'registrado_por' => $request->user()->id,
                'confirmado_por' => $request->user()->id,
                'confirmado_em' => $confirmedAt,
            ]);

            return $donation;
        });

        return new InternalDonationResource($donation->load(['ong:id,nome', 'doador:id,nome', 'confirmador:id,nome', 'cancelador:id,nome']));
    }

    public function cancel(Request $request, int $doacao): InternalDonationResource
    {
        $donation = DB::transaction(function () use ($request, $doacao): Donation {
            $donation = $this->internal($request)->lockForUpdate()->findOrFail($doacao);
            Gate::authorize('cancel', $donation);
            if ($donation->status !== 'PENDENTE') {
                throw new HttpException(409, 'Esta doação não pode ser cancelada.');
            }
            $donation->update(['status' => 'CANCELADA', 'cancelado_em' => now(), 'cancelado_por' => $request->user()->id]);

            return $donation;
        });

        return new InternalDonationResource($donation->load(['ong:id,nome', 'doador:id,nome', 'confirmador:id,nome', 'cancelador:id,nome']));
    }
}
