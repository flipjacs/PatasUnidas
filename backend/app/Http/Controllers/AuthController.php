<?php

namespace App\Http\Controllers;

use App\Http\Resources\UsuarioResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        abort_unless($request->hasSession(), 419, 'Sessão indisponível. Inicialize a proteção CSRF.');
        if (is_string($request->input('email'))) {
            $request->merge(['email' => mb_strtolower(trim($request->input('email')))]);
        }
        $data = $request->validate(['email' => ['required', 'string', 'email', 'max:120'], 'senha' => ['required', 'string', 'max:72']]);
        $email = mb_strtolower(trim($data['email']));
        $key = 'login:'.hash('sha256', Str::lower($email).'|'.$request->ip());
        if (RateLimiter::tooManyAttempts($key, 5)) {
            return response()->json(['message' => 'Muitas tentativas. Tente novamente mais tarde.'], 429, ['Retry-After' => RateLimiter::availableIn($key)]);
        }
        if (! Auth::guard('web')->attempt(['email' => $email, 'password' => $data['senha'], 'ativo' => true])) {
            RateLimiter::hit($key, 60);

            return response()->json(['message' => 'Credenciais inválidas.'], 401);
        }
        RateLimiter::clear($key);
        $request->session()->regenerate();

        return (new UsuarioResource($request->user()))->response();
    }

    public function me(Request $request): UsuarioResource
    {
        return new UsuarioResource($request->user());
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Sessão encerrada.']);
    }
}
