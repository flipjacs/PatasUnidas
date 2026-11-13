<?php

use App\Models\Usuario;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Validator;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('patas-unidas:provisionar-criador', function (): int {
    if (Usuario::where('perfil', 'criador_plataforma')->exists()) {
        $this->error('A conta do criador já existe.');

        return 1;
    }

    $nome = trim((string) $this->ask('Nome do criador'));
    $email = mb_strtolower(trim((string) $this->ask('E-mail do criador')));
    $senha = (string) $this->secret('Senha');
    $confirmacao = (string) $this->secret('Confirme a senha');
    $validator = Validator::make(compact('nome', 'email', 'senha', 'confirmacao'), [
        'nome' => ['required', 'string', 'max:100'],
        'email' => ['required', 'email', 'max:120', 'unique:usuario,email'],
        'senha' => ['required', 'string', 'min:8', 'max:72', function (string $attribute, mixed $value, Closure $fail): void {
            if (is_string($value) && (strlen($value) > 72 || trim($value) === '')) {
                $fail('A senha é inválida ou excede 72 bytes.');
            }
        }],
        'confirmacao' => ['same:senha'],
    ]);
    if ($validator->fails()) {
        foreach ($validator->errors()->all() as $error) {
            $this->error($error);
        }

        return 1;
    }

    Usuario::create([
        'nome' => $nome,
        'email' => $email,
        'senha_hash' => Hash::driver('bcrypt')->make($senha),
        'perfil' => 'criador_plataforma',
        'ong_id' => null,
        'ativo' => true,
    ]);
    $this->info('Conta do criador provisionada.');

    return 0;
})->purpose('Provisiona a conta exclusiva do criador da plataforma');

Artisan::command('patas-unidas:convite-admin {usuario}', function (int $usuario): int {
    $admin = Usuario::query()->whereKey($usuario)->where('perfil', 'administrador')->where('ativo', false)->first();
    if (! $admin) {
        $this->error('Administrador pendente não encontrado.');

        return 1;
    }

    $token = Password::broker()->createToken($admin);
    $this->warn('Entregue este token diretamente ao administrador. Ele expira conforme a configuração de autenticação:');
    $this->line($token);

    return 0;
})->purpose('Emite localmente o token de primeiro acesso de um administrador pendente');
