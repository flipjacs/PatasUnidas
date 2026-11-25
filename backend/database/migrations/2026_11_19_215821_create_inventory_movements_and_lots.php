<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_lots', function (Blueprint $t): void {
            $t->id();
            $t->unsignedInteger('ong_id');
            $t->foreign('ong_id')->references('id')->on('ong')->restrictOnDelete();
            $t->foreignId('produto_id')->constrained('inventory_products')->restrictOnDelete();
            $t->string('codigo', 100);
            $t->date('validade')->nullable();
            $t->decimal('quantidade_disponivel', 12, 3)->default(0);
            $t->timestamps();
            $t->unique(['produto_id', 'codigo']);
            $t->index(['ong_id', 'validade']);
        });
        Schema::create('inventory_movements', function (Blueprint $t): void {
            $t->id();
            $t->unsignedInteger('ong_id');
            $t->foreign('ong_id')->references('id')->on('ong')->restrictOnDelete();
            $t->foreignId('produto_id')->constrained('inventory_products')->restrictOnDelete();
            $t->foreignId('unidade_id')->constrained('inventory_units')->restrictOnDelete();
            $t->foreignId('lote_id')->nullable()->constrained('inventory_lots')->restrictOnDelete();
            $t->unsignedInteger('registrado_por');
            $t->foreign('registrado_por')->references('id')->on('usuario')->restrictOnDelete();
            $t->string('tipo', 30);
            $t->decimal('quantidade', 12, 3);
            $t->decimal('saldo_anterior', 12, 3);
            $t->decimal('saldo_posterior', 12, 3);
            $t->text('motivo');
            $t->text('observacoes')->nullable();
            $t->uuid('chave_operacao');
            $t->string('conteudo_hash', 64);
            $t->timestamp('created_at');
            $t->unique(['ong_id', 'chave_operacao']);
            $t->index(['ong_id', 'created_at']);
            $t->index(['produto_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_movements');
        Schema::dropIfExists('inventory_lots');
    }
};
