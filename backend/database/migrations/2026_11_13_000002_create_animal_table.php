<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('animal', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('ong_id');
            $table->foreign('ong_id')->references('id')->on('ong');
            $table->string('nome', 100);
            $table->string('especie', 20);
            $table->string('sexo', 20);
            $table->string('porte', 20);
            $table->unsignedSmallInteger('idade_aproximada');
            $table->text('descricao')->nullable();
            $table->string('situacao', 30)->default('DISPONIVEL');
            $table->timestamps();
            $table->index(['ong_id', 'situacao']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('animal');
    }
};
