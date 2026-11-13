<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('adoption_requests', function (Blueprint $table): void {
            $table->text('justificativa_cancelamento')->nullable();
            $table->unsignedInteger('cancelado_por')->nullable();
            $table->foreign('cancelado_por')->references('id')->on('usuario');
            $table->timestamp('cancelado_em')->nullable();
        });

        Schema::create('adoptions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('adoption_request_id')->unique()->constrained('adoption_requests');
            $table->foreignId('animal_id')->unique()->constrained('animal');
            $table->unsignedInteger('usuario_id');
            $table->foreign('usuario_id')->references('id')->on('usuario');
            $table->unsignedInteger('ong_id');
            $table->foreign('ong_id')->references('id')->on('ong');
            $table->unsignedInteger('confirmado_por');
            $table->foreign('confirmado_por')->references('id')->on('usuario');
            $table->timestamp('data_entrega');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('adoptions');
        Schema::table('adoption_requests', function (Blueprint $table): void {
            $table->dropForeign(['cancelado_por']);
            $table->dropColumn(['justificativa_cancelamento', 'cancelado_por', 'cancelado_em']);
        });
    }
};
