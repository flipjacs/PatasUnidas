<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sponsorships', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('animal_id')->constrained('animal');
            $table->unsignedInteger('ong_id');
            $table->foreign('ong_id')->references('id')->on('ong');
            $table->unsignedInteger('usuario_id');
            $table->foreign('usuario_id')->references('id')->on('usuario');
            $table->string('modalidade', 10);
            $table->decimal('valor', 12, 2);
            $table->string('status', 12)->default('ATIVO');
            $table->date('data_inicio');
            $table->date('data_encerramento')->nullable();
            $table->string('motivo_encerramento', 40)->nullable();
            $table->text('justificativa_encerramento')->nullable();
            $table->timestamps();
            $table->index(['usuario_id', 'status', 'created_at']);
            $table->index(['ong_id', 'status', 'created_at']);
            $table->index(['animal_id', 'status']);
        });

        Schema::create('sponsorship_installments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sponsorship_id')->constrained('sponsorships');
            $table->unsignedSmallInteger('numero');
            $table->decimal('valor', 12, 2);
            $table->date('vencimento');
            $table->string('status', 12)->default('PENDENTE');
            $table->timestamp('confirmado_em')->nullable();
            $table->unsignedInteger('confirmado_por')->nullable();
            $table->foreign('confirmado_por')->references('id')->on('usuario');
            $table->timestamps();
            $table->unique(['sponsorship_id', 'numero']);
            $table->unique(['sponsorship_id', 'vencimento']);
            $table->index(['sponsorship_id', 'status', 'vencimento']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sponsorship_installments');
        Schema::dropIfExists('sponsorships');
    }
};
