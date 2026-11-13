<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('adoption_requests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('animal_id')->constrained('animal');
            $table->unsignedInteger('usuario_id');
            $table->foreign('usuario_id')->references('id')->on('usuario');
            $table->unsignedInteger('ong_id');
            $table->foreign('ong_id')->references('id')->on('ong');
            $table->string('status', 20)->default('PENDENTE');
            $table->text('mensagem')->nullable();
            $table->text('justificativa_rejeicao')->nullable();
            $table->unsignedInteger('analisado_por')->nullable();
            $table->foreign('analisado_por')->references('id')->on('usuario');
            $table->timestamp('analisado_em')->nullable();
            $table->timestamps();
            $table->index(['usuario_id', 'created_at']);
            $table->index(['ong_id', 'status', 'created_at']);
            $table->index(['animal_id', 'usuario_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('adoption_requests');
    }
};
