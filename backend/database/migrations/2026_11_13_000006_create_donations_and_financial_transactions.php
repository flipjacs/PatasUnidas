<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('donations', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('ong_id');
            $table->foreign('ong_id')->references('id')->on('ong');
            $table->unsignedInteger('usuario_id')->nullable();
            $table->foreign('usuario_id')->references('id')->on('usuario');
            $table->decimal('valor', 12, 2);
            $table->string('status', 20)->default('PENDENTE');
            $table->text('mensagem')->nullable();
            $table->unsignedInteger('confirmado_por')->nullable();
            $table->foreign('confirmado_por')->references('id')->on('usuario');
            $table->timestamp('confirmado_em')->nullable();
            $table->timestamp('cancelado_em')->nullable();
            $table->unsignedInteger('cancelado_por')->nullable();
            $table->foreign('cancelado_por')->references('id')->on('usuario');
            $table->timestamps();
            $table->index(['ong_id', 'status', 'created_at']);
            $table->index(['usuario_id', 'created_at']);
        });

        Schema::create('financial_transactions', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('ong_id');
            $table->foreign('ong_id')->references('id')->on('ong');
            $table->string('tipo', 20);
            $table->string('categoria', 40);
            $table->string('descricao', 255);
            $table->decimal('valor', 12, 2);
            $table->string('status', 20);
            $table->string('origem_tipo', 40)->nullable();
            $table->unsignedBigInteger('origem_id')->nullable();
            $table->unsignedInteger('registrado_por')->nullable();
            $table->foreign('registrado_por')->references('id')->on('usuario');
            $table->unsignedInteger('confirmado_por')->nullable();
            $table->foreign('confirmado_por')->references('id')->on('usuario');
            $table->timestamp('confirmado_em')->nullable();
            $table->timestamps();
            $table->unique(['origem_tipo', 'origem_id']);
            $table->index(['ong_id', 'status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_transactions');
        Schema::dropIfExists('donations');
    }
};
