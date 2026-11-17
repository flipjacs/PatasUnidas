<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('medical_records', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('animal_id')->constrained('animal');
            $table->unsignedInteger('ong_id');
            $table->foreign('ong_id')->references('id')->on('ong');
            $table->unsignedInteger('registrado_por');
            $table->foreign('registrado_por')->references('id')->on('usuario');
            $table->string('tipo', 20);
            $table->string('titulo', 120);
            $table->text('descricao');
            $table->date('data_procedimento');
            $table->string('profissional_responsavel', 120)->nullable();
            $table->text('medicamentos')->nullable();
            $table->text('observacoes')->nullable();
            $table->timestamps();
            $table->index(['animal_id', 'data_procedimento', 'id']);
            $table->index(['animal_id', 'tipo', 'data_procedimento']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medical_records');
    }
};
