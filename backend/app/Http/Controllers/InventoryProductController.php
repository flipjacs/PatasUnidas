<?php

namespace App\Http\Controllers;

use App\Http\Requests\InventoryProductRequest;
use App\Http\Resources\InventoryProductResource;
use App\Models\InventoryProduct;
use App\Models\InventoryUnit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class InventoryProductController extends Controller
{
    private function own(Request $request): Builder
    {
        Gate::authorize('viewAny', InventoryProduct::class);

        return InventoryProduct::where('ong_id', $request->user()->ong_id);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = $this->own($request);
        $filters = $request->validate([
            'busca' => ['sometimes', 'string', 'max:150'], 'ativo' => ['sometimes', 'boolean'],
            'categoriaId' => ['sometimes', 'integer', Rule::exists('inventory_categories', 'id')->where(fn ($q) => $q->where(fn ($q) => $q->whereNull('ong_id')->orWhere('ong_id', $request->user()->ong_id)))],
            'unidadeId' => ['sometimes', 'integer', Rule::exists('inventory_units', 'id')],
            'localId' => ['sometimes', 'integer', Rule::exists('storage_locations', 'id')->where('ong_id', $request->user()->ong_id)],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);
        foreach (array_diff(array_keys($request->all()), array_keys($filters)) as $field) {
            throw ValidationException::withMessages([$field => 'Filtro não permitido.']);
        }
        if (isset($filters['busca'])) {
            $query->where('nome', 'like', '%'.$filters['busca'].'%');
        }
        foreach (['ativo' => 'ativo', 'categoriaId' => 'categoria_id', 'unidadeId' => 'unidade_id', 'localId' => 'local_id'] as $key => $column) {
            if (isset($filters[$key])) {
                $query->where($column, $filters[$key]);
            }
        }

        return InventoryProductResource::collection($query->with(['categoria', 'unidade', 'local'])->orderByDesc('id')->paginate(15));
    }

    public function show(Request $request, int $produto): InventoryProductResource
    {
        return new InventoryProductResource($this->own($request)->with(['categoria', 'unidade', 'local'])->withSum('lotes', 'quantidade_disponivel')->withCount(['lotes as lotes_disponiveis' => fn ($q) => $q->where('quantidade_disponivel', '>', 0)])->findOrFail($produto));
    }

    private function saveProduct(InventoryProductRequest $request, ?int $id): InventoryProduct
    {
        try {
            return DB::transaction(function () use ($request, $id): InventoryProduct {
                $product = $id === null ? new InventoryProduct : $this->own($request)->lockForUpdate()->findOrFail($id);
                if ($id !== null) {
                    Gate::authorize('update', $product);
                }
                $data = $request->validated();
                $values = [];
                foreach (['nome' => 'nome', 'marca' => 'marca', 'descricao' => 'descricao', 'observacoes' => 'observacoes', 'codigoInterno' => 'codigo_interno', 'categoriaId' => 'categoria_id', 'unidadeId' => 'unidade_id', 'localId' => 'local_id', 'controlaValidade' => 'controla_validade', 'quantidadeMinima' => 'quantidade_minima'] as $key => $column) {
                    if (array_key_exists($key, $data)) {
                        $values[$column] = $data[$key];
                    }
                }
                if ($id !== null && isset($values['unidade_id']) && (int) $values['unidade_id'] !== (int) $product->unidade_id
                    && ($product->unidade_fixada_em !== null || preg_match('/[1-9]/', $product->quantidade_disponivel))) {
                    throw new HttpException(409, 'A unidade está protegida pelo histórico ou saldo do produto.');
                }
                if ($id !== null && array_key_exists('controla_validade', $values) && (bool) $values['controla_validade'] !== $product->controla_validade && $product->unidade_fixada_em !== null) {
                    throw new HttpException(409, 'O controle de validade está protegido pelo histórico do produto.');
                }
                $unit = InventoryUnit::findOrFail($values['unidade_id'] ?? $product->unidade_id);
                $minimum = $values['quantidade_minima'] ?? $product->quantidade_minima ?? '0';
                if (! $unit->fracionavel && preg_match('/\.\d*[1-9]/', $minimum)) {
                    throw ValidationException::withMessages(['quantidadeMinima' => 'Esta unidade exige quantidade inteira.']);
                }
                $product->fill($values);
                $product->identidade = hash('sha256', json_encode([mb_strtolower($product->nome), mb_strtolower($product->marca ?? ''), (int) $product->unidade_id]));
                if ($id === null) {
                    $product->ong_id = $request->user()->ong_id;
                }
                $product->save();

                return $product->refresh()->load(['categoria', 'unidade', 'local']);
            });
        } catch (UniqueConstraintViolationException) {
            throw new HttpException(409, 'Já existe um produto com o mesmo nome, marca e unidade, ou com este código interno nesta ONG.');
        }
    }

    public function store(InventoryProductRequest $request): JsonResponse
    {
        return (new InventoryProductResource($this->saveProduct($request, null)))->response()->setStatusCode(201);
    }

    public function update(InventoryProductRequest $request, int $produto): InventoryProductResource
    {
        return new InventoryProductResource($this->saveProduct($request, $produto));
    }

    public function deactivate(Request $request, int $produto): InventoryProductResource
    {
        $product = $this->own($request)->findOrFail($produto);
        Gate::authorize('changeStatus', $product);
        if ($request->all() !== []) {
            throw ValidationException::withMessages(['payload' => 'Campos não permitidos.']);
        }
        $product->ativo = false;
        $product->save();

        return new InventoryProductResource($product->load(['categoria', 'unidade', 'local']));
    }
}
