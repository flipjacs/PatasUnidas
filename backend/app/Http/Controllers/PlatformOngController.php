<?php

namespace App\Http\Controllers;

use App\Http\Requests\OngRequest;
use App\Http\Requests\PrimeiroAdministradorRequest;
use App\Http\Resources\OngResource;
use App\Http\Resources\UsuarioResource;
use App\Models\Ong;
use App\Models\Usuario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

class PlatformOngController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Ong::class);

        return OngResource::collection(Ong::query()->orderBy('id')->paginate(15));
    }

    public function store(OngRequest $request): JsonResponse
    {
        Gate::authorize('create', Ong::class);
        $ong = Ong::create([...$request->validated(), 'status' => 'SUSPENSA']);

        return (new OngResource($ong))->response()->setStatusCode(201);
    }

    public function show(Ong $ong): OngResource
    {
        Gate::authorize('view', $ong);

        return new OngResource($ong);
    }

    public function update(OngRequest $request, Ong $ong): OngResource
    {
        Gate::authorize('update', $ong);
        $ong->update($request->validated());

        return new OngResource($ong);
    }

    public function suspender(Ong $ong): OngResource
    {
        Gate::authorize('update', $ong);
        $ong->update(['status' => 'SUSPENSA']);

        return new OngResource($ong);
    }

    public function reativar(Ong $ong): OngResource
    {
        Gate::authorize('update', $ong);
        if (! $ong->usuarios()->where('perfil', 'administrador')->where('ativo', true)->exists()) {
            throw new HttpException(409, 'A ONG precisa de um administrador ativo para ser reativada.');
        }
        $ong->update(['status' => 'ATIVA']);

        return new OngResource($ong);
    }

    public function primeiroAdministrador(PrimeiroAdministradorRequest $request, Ong $ong): JsonResponse
    {
        Gate::authorize('update', $ong);
        $admin = DB::transaction(function () use ($ong, $request): Usuario {
            $locked = Ong::query()->lockForUpdate()->findOrFail($ong->id);
            if ($locked->status !== 'SUSPENSA' || $locked->usuarios()->where('perfil', 'administrador')->exists()) {
                throw new HttpException(409, 'O primeiro administrador já foi definido ou a ONG está ativa.');
            }

            return Usuario::create([
                ...$request->validated(),
                'senha_hash' => Hash::driver('bcrypt')->make(Str::random(64)),
                'perfil' => 'administrador',
                'ong_id' => $locked->id,
                'ativo' => false,
            ]);
        });

        return (new UsuarioResource($admin))->response()->setStatusCode(201);
    }
}
