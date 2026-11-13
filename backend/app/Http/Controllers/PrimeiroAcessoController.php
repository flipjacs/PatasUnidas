<?php

namespace App\Http\Controllers;

use App\Models\Usuario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;

class PrimeiroAcessoController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:120'],
            'token' => ['required', 'string'],
            'senha' => ['required', 'string', 'min:8', 'max:72', function (string $attribute, mixed $value, \Closure $fail): void {
                if (is_string($value) && (strlen($value) > 72 || trim($value) === '')) {
                    $fail('A senha é inválida ou excede 72 bytes.');
                }
            }],
        ]);
        $email = mb_strtolower(trim($data['email']));
        $admin = Usuario::query()->where('email', $email)->where('perfil', 'administrador')->where('ativo', false)->first();
        if (! $admin || ! Password::broker()->tokenExists($admin, $data['token'])) {
            return response()->json(['message' => 'Convite inválido ou expirado.'], 400);
        }

        $admin->update(['senha_hash' => Hash::driver('bcrypt')->make($data['senha']), 'ativo' => true]);
        Password::broker()->deleteToken($admin);

        return response()->json(['message' => 'Senha definida. A conta está ativa.']);
    }
}
