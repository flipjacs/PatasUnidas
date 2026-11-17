<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transparency_reports', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('ong_id');
            $table->foreign('ong_id')->references('id')->on('ong');
            $table->date('periodo_inicio');
            $table->date('periodo_fim');
            $table->string('titulo', 120);
            $table->text('descricao')->nullable();
            $table->string('status', 12)->default('RASCUNHO');
            $table->json('dados_consolidados');
            $table->unsignedInteger('publicado_por')->nullable();
            $table->foreign('publicado_por')->references('id')->on('usuario');
            $table->timestamp('publicado_em')->nullable();
            $table->timestamp('despublicado_em')->nullable();
            $table->timestamps();
            $table->index(['ong_id', 'status', 'publicado_em']);
            $table->index(['ong_id', 'periodo_inicio', 'periodo_fim']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transparency_reports');
    }
};
