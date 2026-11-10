<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ong', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('nome', 120);
            $table->string('cnpj_cpf', 20)->nullable();
            $table->string('email', 120);
            $table->string('telefone', 20)->nullable();
            $table->string('cidade', 80)->nullable();
            $table->char('estado', 2)->nullable();
        });
        Schema::create('usuario', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('ong_id')->nullable();
            $table->foreign('ong_id')->references('id')->on('ong');
            $table->string('nome', 100);
            $table->string('email', 120)->unique();
            $table->string('senha_hash', 255);
            $table->string('perfil', 20);
            $table->boolean('ativo')->default(true);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('usuario');
        Schema::dropIfExists('ong');
    }
};
