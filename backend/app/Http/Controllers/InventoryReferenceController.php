<?php

namespace App\Http\Controllers;

use App\Http\Requests\InventoryReferenceRequest;
use App\Http\Resources\InventoryReferenceResource;
use App\Models\InventoryCategory;
use App\Models\InventoryProduct;
use App\Models\InventoryUnit;
use App\Models\StorageLocation;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class InventoryReferenceController extends Controller
{
    public function categories(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', InventoryProduct::class);

        return InventoryReferenceResource::collection(InventoryCategory::where(fn ($q) => $q->whereNull('ong_id')->orWhere('ong_id', $request->user()->ong_id))->orderBy('nome')->get());
    }

    public function units(): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', InventoryProduct::class);

        return InventoryReferenceResource::collection(InventoryUnit::orderBy('id')->get());
    }

    public function locations(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', InventoryProduct::class);

        return InventoryReferenceResource::collection(StorageLocation::where('ong_id', $request->user()->ong_id)->orderBy('nome')->get());
    }

    private function categoryName(InventoryCategory $category, array $data): void
    {
        $category->fill($data);
        $category->nome_chave = mb_strtolower($category->nome);
        if (InventoryCategory::where('escopo', 'GLOBAL')->where('nome_chave', $category->nome_chave)->exists()) {
            throw new HttpException(409, 'Já existe uma categoria padronizada com este nome.');
        }
        try {
            $category->save();
        } catch (UniqueConstraintViolationException) {
            throw new HttpException(409, 'Categoria já cadastrada nesta ONG.');
        }
    }

    public function storeCategory(InventoryReferenceRequest $request): JsonResponse
    {
        $category = new InventoryCategory;
        $category->ong_id = $request->user()->ong_id;
        $category->escopo = 'ONG:'.$request->user()->ong_id;
        $this->categoryName($category, $request->validated());

        return (new InventoryReferenceResource($category->refresh()))->response()->setStatusCode(201);
    }

    public function updateCategory(InventoryReferenceRequest $request, int $categoria): InventoryReferenceResource
    {
        $category = InventoryCategory::where('ong_id', $request->user()->ong_id)->findOrFail($categoria);
        $this->categoryName($category, $request->validated());

        return new InventoryReferenceResource($category);
    }

    public function deactivateCategory(Request $request, int $categoria): InventoryReferenceResource
    {
        Gate::authorize('viewAny', InventoryProduct::class);
        $category = InventoryCategory::where('ong_id', $request->user()->ong_id)->findOrFail($categoria);
        Gate::authorize('manageReferences', InventoryProduct::class);
        if ($request->all() !== []) {
            throw ValidationException::withMessages(['payload' => 'Campos não permitidos.']);
        }
        $category->update(['ativo' => false]);

        return new InventoryReferenceResource($category);
    }

    private function saveLocation(StorageLocation $location, array $data): void
    {
        $location->fill($data);
        $location->nome_chave = mb_strtolower($location->nome);
        try {
            $location->save();
        } catch (UniqueConstraintViolationException) {
            throw new HttpException(409, 'Local já cadastrado nesta ONG.');
        }
    }

    public function storeLocation(InventoryReferenceRequest $request): JsonResponse
    {
        $location = new StorageLocation;
        $location->ong_id = $request->user()->ong_id;
        $this->saveLocation($location, $request->validated());

        return (new InventoryReferenceResource($location->refresh()))->response()->setStatusCode(201);
    }

    public function updateLocation(InventoryReferenceRequest $request, int $local): InventoryReferenceResource
    {
        $location = StorageLocation::where('ong_id', $request->user()->ong_id)->findOrFail($local);
        $this->saveLocation($location, $request->validated());

        return new InventoryReferenceResource($location);
    }

    public function deactivateLocation(Request $request, int $local): InventoryReferenceResource
    {
        Gate::authorize('viewAny', InventoryProduct::class);
        $location = StorageLocation::where('ong_id', $request->user()->ong_id)->findOrFail($local);
        Gate::authorize('manageReferences', InventoryProduct::class);
        if ($request->all() !== []) {
            throw ValidationException::withMessages(['payload' => 'Campos não permitidos.']);
        }
        $location->update(['ativo' => false]);

        return new InventoryReferenceResource($location);
    }
}
