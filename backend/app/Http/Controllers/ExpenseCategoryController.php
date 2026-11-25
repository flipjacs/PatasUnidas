<?php

namespace App\Http\Controllers;

use App\Http\Requests\ExpenseCategoryRequest;
use App\Models\ExpenseCategory;
use App\Models\FinancialTransaction;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpKernel\Exception\HttpException;

class ExpenseCategoryController extends Controller
{
    private function serialize(ExpenseCategory $category, Request $request): array
    {
        return [
            'id' => $category->id, 'nome' => $category->nome, 'codigo' => $category->codigo,
            'global' => $category->ong_id === null, 'ativo' => $category->ativo,
            'gerenciavel' => $category->ong_id !== null && $request->user()->perfil === 'administrador',
        ];
    }

    private function own(Request $request, int $id): ExpenseCategory
    {
        $category = ExpenseCategory::where('ong_id', $request->user()->ong_id)->findOrFail($id);
        Gate::authorize('manageCategory', FinancialTransaction::class);

        return $category;
    }

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', FinancialTransaction::class);
        $categories = ExpenseCategory::where(function ($query) use ($request): void {
            $query->whereNull('ong_id')->orWhere('ong_id', $request->user()->ong_id);
        })->orderBy('nome')->get();

        return response()->json(['data' => $categories->map(fn (ExpenseCategory $category): array => $this->serialize($category, $request))]);
    }

    public function store(ExpenseCategoryRequest $request): JsonResponse
    {
        Gate::authorize('manageCategory', FinancialTransaction::class);
        $name = $request->validated('nome');
        $scope = 'ONG:'.$request->user()->ong_id;
        $key = mb_strtolower($name);
        if (ExpenseCategory::where('escopo', 'GLOBAL')->where('nome_chave', $key)->exists()) {
            throw new HttpException(409, 'Categoria já existente.');
        }
        try {
            $category = ExpenseCategory::create(['ong_id' => $request->user()->ong_id, 'nome' => $name,
                'nome_chave' => $key, 'escopo' => $scope, 'ativo' => true]);
        } catch (UniqueConstraintViolationException) {
            throw new HttpException(409, 'Categoria já existente.');
        }

        return response()->json($this->serialize($category, $request), 201);
    }

    public function update(ExpenseCategoryRequest $request, int $categoria): JsonResponse
    {
        $category = $this->own($request, $categoria);
        $name = $request->validated('nome');
        $key = mb_strtolower($name);
        if (ExpenseCategory::where('escopo', 'GLOBAL')->where('nome_chave', $key)->exists()) {
            throw new HttpException(409, 'Categoria já existente.');
        }
        try {
            $category->update(['nome' => $name, 'nome_chave' => $key]);
        } catch (UniqueConstraintViolationException) {
            throw new HttpException(409, 'Categoria já existente.');
        }

        return response()->json($this->serialize($category, $request));
    }

    public function deactivate(Request $request, int $categoria): JsonResponse
    {
        $category = $this->own($request, $categoria);
        if ($request->all() !== []) {
            throw new HttpException(400, 'Campos não permitidos.');
        }
        $category->update(['ativo' => false]);

        return response()->json($this->serialize($category, $request));
    }
}
