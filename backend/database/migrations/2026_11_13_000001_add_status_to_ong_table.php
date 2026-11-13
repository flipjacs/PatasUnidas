<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ong', function (Blueprint $table): void {
            $table->string('status', 10)->default('ATIVA');
        });
    }

    public function down(): void
    {
        Schema::table('ong', function (Blueprint $table): void {
            $table->dropColumn('status');
        });
    }
};
