<?php

namespace App\Services;

use App\Models\FinancialTransaction;
use App\Models\InventoryLot;
use App\Models\InventoryMovement;
use App\Models\InventoryProduct;
use App\Models\Usuario;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class InventoryMovementService
{
    public static function milli(string $value): int
    {
        [$whole,$fraction] = array_pad(explode('.', $value, 2), 2, '');

        return (int) $whole * 1000 + (int) str_pad($fraction, 3, '0');
    }

    public static function decimal(int $value): string
    {
        return intdiv($value, 1000).'.'.str_pad((string) ($value % 1000), 3, '0', STR_PAD_LEFT);
    }

    private function replay(InventoryMovement $movement, string $hash): array
    {
        abort_unless(hash_equals($movement->conteudo_hash, $hash), 409, 'Chave de operação já utilizada com outro conteúdo.');

        return [$movement, false];
    }

    public function execute(Usuario $user, array $data): array
    {
        $data['quantidade'] = self::decimal(self::milli($data['quantidade']));
        $data['produtoId'] = (int) $data['produtoId'];
        $data['loteId'] = isset($data['loteId']) ? (int) $data['loteId'] : null;
        $data['observacoes'] = $data['observacoes'] ?? null;
        $data['chaveOperacao'] = strtolower($data['chaveOperacao']);
        if (isset($data['lote'])) {
            $data['lote'] = ['codigo' => mb_strtoupper(trim($data['lote']['codigo'])), 'validade' => $data['lote']['validade'] ?? null];
        }
        $data['despesaId'] = isset($data['despesaId']) ? (int) $data['despesaId'] : null;
        $fingerprint = [$data['produtoId'], $data['tipo'], $data['quantidade'], $data['motivo'], $data['observacoes'], $data['loteId'], $data['lote'] ?? null, $user->id];
        if ($data['despesaId'] !== null) {
            $fingerprint[] = $data['despesaId'];
        }
        $hash = hash('sha256', json_encode($fingerprint));
        try {
            return DB::transaction(function () use ($user, $data, $hash): array {
                $product = InventoryProduct::where('ong_id', $user->ong_id)->lockForUpdate()->findOrFail($data['produtoId']);
                $previous = InventoryMovement::where('ong_id', $user->ong_id)->where('chave_operacao', $data['chaveOperacao'])->lockForUpdate()->first();
                if ($previous) {
                    return $this->replay($previous, $hash);
                }
                abort_unless($product->ativo, 409, 'Produto inativo.');
                if ($data['despesaId'] !== null) {
                    Gate::forUser($user)->authorize('viewAny', FinancialTransaction::class);
                    $expense = FinancialTransaction::where('ong_id', $user->ong_id)->lockForUpdate()->findOrFail($data['despesaId']);
                    abort_unless($data['tipo'] === 'ENTRADA_COMPRA' && $expense->isEligibleForInventory(), 409, 'Despesa indisponível para vínculo de compra.');
                }

                $amount = self::milli($data['quantidade']);
                $before = self::milli($product->quantidade_disponivel);
                if (! $product->unidade->fracionavel && $amount % 1000 !== 0) {
                    throw ValidationException::withMessages(['quantidade' => 'Esta unidade exige quantidade inteira.']);
                }
                $positive = in_array($data['tipo'], ['ENTRADA_COMPRA', 'ENTRADA_DOACAO', 'ENTRADA_DEVOLUCAO', 'AJUSTE_POSITIVO'], true);
                $lot = null;
                if (isset($data['loteId'])) {
                    $lot = InventoryLot::where('ong_id', $user->ong_id)->where('produto_id', $product->id)->lockForUpdate()->findOrFail($data['loteId']);
                }
                if (isset($data['lote'])) {
                    abort_unless($positive, 409, 'Saídas exigem seleção de um lote existente.');
                    $lot = InventoryLot::where('produto_id', $product->id)->where('codigo', $data['lote']['codigo'])->lockForUpdate()->first();
                    if ($lot) {
                        abort_unless($lot->validade?->format('Y-m-d') === $data['lote']['validade'], 409, 'A validade do lote não pode ser substituída.');
                    } else {
                        $lot = new InventoryLot;
                        $lot->forceFill(['ong_id' => $user->ong_id, 'produto_id' => $product->id, 'codigo' => $data['lote']['codigo'], 'validade' => $data['lote']['validade'], 'quantidade_disponivel' => '0.000']);
                    }
                }
                if ($positive && $product->controla_validade && ! $lot?->validade) {
                    throw ValidationException::withMessages(['lote' => 'Este produto exige lote com data de validade.']);
                }
                $available = $lot ? self::milli($lot->quantidade_disponivel) : $before - self::milli((string) InventoryLot::where('produto_id', $product->id)->sum('quantidade_disponivel'));
                if (! $positive) {
                    abort_if($amount > $available || $amount > $before, 409, 'Saldo insuficiente no lote ou na quantidade sem lote.');
                    if ($data['tipo'] === 'SAIDA_CONSUMO' && $lot?->validade) {
                        abort_if($lot->validade->format('Y-m-d') < now()->toDateString(), 409, 'Lote vencido: consumo não permitido.');
                    }
                }
                $after = $before + ($positive ? $amount : -$amount);
                abort_if($after > 999999999999, 409, 'Saldo excede o limite permitido.');
                if ($lot) {
                    $lot->quantidade_disponivel = self::decimal($available + ($positive ? $amount : -$amount));
                    $lot->save();
                }
                $product->quantidade_disponivel = self::decimal($after);
                $product->unidade_fixada_em ??= now();
                $product->save();
                $movement = new InventoryMovement;
                $movement->forceFill(['ong_id' => $user->ong_id, 'despesa_id' => $data['despesaId'], 'produto_id' => $product->id, 'unidade_id' => $product->unidade_id, 'lote_id' => $lot?->id, 'registrado_por' => $user->id, 'tipo' => $data['tipo'], 'quantidade' => $data['quantidade'], 'saldo_anterior' => self::decimal($before), 'saldo_posterior' => self::decimal($after), 'motivo' => $data['motivo'], 'observacoes' => $data['observacoes'], 'chave_operacao' => $data['chaveOperacao'], 'conteudo_hash' => $hash, 'created_at' => now()])->save();

                return [$movement, true];
            }, 3);
        } catch (UniqueConstraintViolationException) {
            $previous = InventoryMovement::where('ong_id', $user->ong_id)->where('chave_operacao', $data['chaveOperacao'])->first();
            if ($previous) {
                return $this->replay($previous, $hash);
            } throw new HttpException(409, 'Conflito no registro do lote ou da operação.');
        }
    }
}
