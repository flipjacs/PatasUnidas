<?php

use App\Models\AnimalPhoto;
use App\Models\Usuario;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('patas-unidas:migrar-fotos-privadas', function (): int {
    $public = Storage::disk('public');
    $private = Storage::disk('local');
    $photos = AnimalPhoto::query()->orderBy('id')->get(['id', 'animal_id', 'caminho']);
    $migrated = 0;
    $alreadyPrivate = 0;
    $removedPublic = 0;
    $problems = 0;

    foreach ($photos as $photo) {
        $path = $photo->caminho;
        if (! preg_match('~^animais/'.preg_quote((string) $photo->animal_id, '~').'/[A-Za-z0-9._-]+$~D', $path)) {
            $this->error("Fotografia {$photo->id}: caminho inválido.");
            $problems++;

            continue;
        }

        $publicExists = $public->exists($path);
        $privateExists = $private->exists($path);
        if (! $publicExists && ! $privateExists) {
            $this->error("Fotografia {$photo->id}: arquivo ausente nos dois discos.");
            $problems++;

            continue;
        }
        if (! $publicExists) {
            $alreadyPrivate++;

            continue;
        }

        $sourceHash = hash_file('sha256', $public->path($path));
        if ($sourceHash === false) {
            $this->error("Fotografia {$photo->id}: não foi possível verificar o arquivo público.");
            $problems++;

            continue;
        }
        if (! $privateExists) {
            $temporaryPath = 'animais/.migracao/'.Str::uuid();
            $stream = $public->readStream($path);
            if ($stream === false) {
                $this->error("Fotografia {$photo->id}: leitura do arquivo público falhou.");
                $problems++;

                continue;
            }
            try {
                $copied = $private->writeStream($temporaryPath, $stream);
            } finally {
                fclose($stream);
            }
            if (! $copied || ! $private->exists($temporaryPath)
                || hash_file('sha256', $private->path($temporaryPath)) !== $sourceHash) {
                $private->delete($temporaryPath);
                $this->error("Fotografia {$photo->id}: cópia privada não conferiu com a origem.");
                $problems++;

                continue;
            }
            if (! $private->move($temporaryPath, $path)) {
                $private->delete($temporaryPath);
                $this->error("Fotografia {$photo->id}: não foi possível concluir a cópia privada.");
                $problems++;

                continue;
            }
            $migrated++;
        } elseif (hash_file('sha256', $private->path($path)) !== $sourceHash) {
            $this->error("Fotografia {$photo->id}: arquivos público e privado divergem.");
            $problems++;

            continue;
        } else {
            $alreadyPrivate++;
        }

        if (! $public->delete($path)) {
            $this->error("Fotografia {$photo->id}: arquivo público não pôde ser retirado.");
            $problems++;

            continue;
        }
        $removedPublic++;
    }

    $knownPaths = $photos->pluck('caminho')->all();
    $orphanPaths = array_diff($public->allFiles('animais'), $knownPaths);
    if ($orphanPaths !== []) {
        $problems += count($orphanPaths);
        $this->error('Há arquivos públicos de animais sem registro correspondente: '.count($orphanPaths).'. Revisão manual necessária.');
    }

    $this->info("Fotografias: {$photos->count()}; copiadas: {$migrated}; já privadas: {$alreadyPrivate}; origens públicas retiradas: {$removedPublic}; inconsistências: {$problems}.");

    return $problems === 0 ? 0 : 1;
})->purpose('Migra fotografias cadastradas para armazenamento privado sem sobrescrever conflitos');

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
