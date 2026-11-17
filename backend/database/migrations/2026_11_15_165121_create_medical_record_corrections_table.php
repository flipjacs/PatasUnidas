<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('medical_record_corrections', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('medical_record_id')->constrained('medical_records');
            $table->unsignedInteger('corrigido_por');
            $table->foreign('corrigido_por')->references('id')->on('usuario');
            $table->text('justificativa');
            $table->json('dados_anteriores');
            $table->json('dados_novos');
            $table->timestamp('created_at')->useCurrent();
            $table->index(['medical_record_id', 'created_at', 'id'], 'medical_corrections_history_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medical_record_corrections');
    }
};
