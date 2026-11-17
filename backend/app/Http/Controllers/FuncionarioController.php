<?php

namespace App\Http\Controllers;

use App\Http\Requests\AtualizacaoFuncionarioRequest;
use App\Http\Resources\FuncionarioResource;
use App\Models\Usuario;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class FuncionarioController extends Controller
{
    private function funcionarios(): Builder
    {
        Gate::authorize('manageEmployees', Usuario::class);

        return Usuario::query()->where('ong_id', auth()->user()->ong_id)
            ->whereIn('perfil', ['voluntario', 'veterinario']);
    }

    private function funcionario(Usuario $usuario): Usuario
    {
        return $this->funcionarios()->whereKey($usuario->id)->first()
            ?? throw new NotFoundHttpException('Funcionário não encontrado.');
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate(['busca' => ['sometimes', 'string', 'min:2', 'max:120']]);
        $query = $this->funcionarios();
        if (isset($filters['busca'])) {
            $term = '%'.addcslashes(trim($filters['busca']), '%_\\').'%';
            $query->where(fn (Builder $employees) => $employees->where('nome', 'like', $term)->orWhere('email', 'like', $term));
        }

        return FuncionarioResource::collection($query->orderBy('id')->paginate(15));
    }

    public function show(Usuario $usuario): FuncionarioResource
    {
        return new FuncionarioResource($this->funcionario($usuario));
    }

    public function update(AtualizacaoFuncionarioRequest $request, Usuario $usuario): FuncionarioResource
    {
        $funcionario = $this->funcionario($usuario);
        $funcionario->update($request->validated());

        return new FuncionarioResource($funcionario);
    }

    public function ativar(Usuario $usuario): FuncionarioResource
    {
        $funcionario = $this->funcionario($usuario);
        $funcionario->update(['ativo' => true]);

        return new FuncionarioResource($funcionario);
    }

    public function desativar(Usuario $usuario): FuncionarioResource
    {
        $funcionario = $this->funcionario($usuario);
        $funcionario->update(['ativo' => false]);

        return new FuncionarioResource($funcionario);
    }
}
