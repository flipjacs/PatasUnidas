<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('financial_transactions', function (Blueprint $table): void {
            $table->unique(['ong_id', 'id'], 'financial_transactions_ong_id_id_unique');
        });
        Schema::table('inventory_movements', function (Blueprint $table): void {
            $table->unsignedBigInteger('despesa_id')->nullable();
            $table->index(['ong_id', 'despesa_id'], 'inventory_movements_ong_expense_index');
            $table->foreign(['ong_id', 'despesa_id'], 'inventory_movements_ong_expense_foreign')->references(['ong_id', 'id'])->on('financial_transactions')->restrictOnDelete()->restrictOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::table('inventory_movements', function (Blueprint $table): void {
            $table->dropForeign('inventory_movements_ong_expense_foreign');
            $table->dropIndex('inventory_movements_ong_expense_index');
            $table->dropColumn('despesa_id');
        });
        Schema::table('financial_transactions', function (Blueprint $table): void {
            $table->dropUnique('financial_transactions_ong_id_id_unique');
        });
    }
};
