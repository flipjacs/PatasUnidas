<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('financial_transactions', function (Blueprint $table): void {
            $table->unsignedInteger('aprovado_por')->nullable();
            $table->foreign('aprovado_por')->references('id')->on('usuario');
            $table->timestamp('aprovado_em')->nullable();
            $table->unsignedInteger('cancelado_por')->nullable();
            $table->foreign('cancelado_por')->references('id')->on('usuario');
            $table->timestamp('cancelado_em')->nullable();
            $table->index(['ong_id', 'tipo', 'status', 'created_at'], 'finance_ong_tipo_status_created');
            $table->index(['ong_id', 'status', 'confirmado_em'], 'finance_ong_status_confirmed');
        });
    }

    public function down(): void
    {
        Schema::table('financial_transactions', function (Blueprint $table): void {
            $table->dropIndex('finance_ong_status_confirmed');
            $table->dropIndex('finance_ong_tipo_status_created');
            $table->dropForeign(['aprovado_por']);
            $table->dropForeign(['cancelado_por']);
            $table->dropColumn(['aprovado_por', 'aprovado_em', 'cancelado_por', 'cancelado_em']);
        });
    }
};
