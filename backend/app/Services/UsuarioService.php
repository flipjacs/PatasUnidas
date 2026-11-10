<?php

namespace App\Services;

use App\Models\Usuario;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpKernel\Exception\HttpException;

class UsuarioService
{
    public function criar(array $dados, string $perfil, ?int $ongId): Usuario
    {
        try {
            return Usuario::create([
                'nome' => $dados['nome'], 'email' => $dados['email'],
                'senha_hash' => Hash::driver('bcrypt')->make($dados['senha']),
                'perfil' => strtolower($perfil), 'ong_id' => $ongId, 'ativo' => true,
            ]);
        } catch (UniqueConstraintViolationException $e) {
            throw new HttpException(409, 'E-mail já cadastrado.', $e);
        }
    }
}
