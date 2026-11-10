<?php

namespace App\Http\Controllers;

use App\Http\Requests\CadastroInternoRequest;
use App\Http\Requests\CadastroPublicoRequest;
use App\Http\Resources\UsuarioResource;
use App\Services\UsuarioService;
use Illuminate\Http\JsonResponse;

class UsuarioController extends Controller
{
    public function publico(CadastroPublicoRequest $request, UsuarioService $service): JsonResponse
    {
        return (new UsuarioResource($service->criar($request->validated(), 'USUARIO', null)))->response()->setStatusCode(201);
    }

    public function interno(CadastroInternoRequest $request, UsuarioService $service): JsonResponse
    {
        return (new UsuarioResource($service->criar($request->validated(), $request->validated('perfil'), $request->user()->ong_id)))->response()->setStatusCode(201);
    }
}
