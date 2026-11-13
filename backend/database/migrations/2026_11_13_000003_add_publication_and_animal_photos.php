<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('animal', function (Blueprint $table): void {
            $table->boolean('publicado')->default(false);
            $table->index(['publicado', 'situacao', 'created_at']);
        });

        Schema::create('animal_photos', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('animal_id')->constrained('animal');
            $table->string('caminho');
            $table->boolean('principal')->default(false);
            $table->timestamps();
            $table->index(['animal_id', 'principal']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('animal_photos');
        Schema::table('animal', function (Blueprint $table): void {
            $table->dropIndex(['publicado', 'situacao', 'created_at']);
            $table->dropColumn('publicado');
        });
    }
};
