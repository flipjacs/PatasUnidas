<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_categories', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('ong_id')->nullable();
            $table->foreign('ong_id')->references('id')->on('ong')->restrictOnDelete();
            $table->string('codigo', 40)->nullable()->unique();
            $table->string('nome', 100);
            $table->string('nome_chave', 100);
            $table->string('escopo', 32);
            $table->boolean('ativo')->default(true);
            $table->timestamps();
            $table->unique(['escopo', 'nome_chave']);
            $table->index(['ong_id', 'ativo']);
        });
        Schema::create('inventory_units', function (Blueprint $table): void {
            $table->id();
            $table->string('codigo', 20)->unique();
            $table->string('nome', 50);
            $table->string('sigla', 10);
            $table->boolean('fracionavel');
        });
        Schema::create('storage_locations', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('ong_id');
            $table->foreign('ong_id')->references('id')->on('ong')->restrictOnDelete();
            $table->string('nome', 100);
            $table->string('nome_chave', 100);
            $table->text('descricao')->nullable();
            $table->boolean('ativo')->default(true);
            $table->timestamps();
            $table->unique(['ong_id', 'nome_chave']);
        });
        Schema::create('inventory_products', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('ong_id');
            $table->foreign('ong_id')->references('id')->on('ong')->restrictOnDelete();
            $table->string('nome', 150);
            $table->string('marca', 100)->nullable();
            $table->string('codigo_interno', 60)->nullable();
            $table->string('identidade', 64);
            $table->text('descricao')->nullable();
            $table->text('observacoes')->nullable();
            $table->foreignId('categoria_id')->constrained('inventory_categories')->restrictOnDelete();
            $table->foreignId('unidade_id')->constrained('inventory_units')->restrictOnDelete();
            $table->foreignId('local_id')->nullable()->constrained('storage_locations')->restrictOnDelete();
            $table->decimal('quantidade_minima', 12, 3)->default(0);
            $table->decimal('quantidade_disponivel', 12, 3)->default(0);
            $table->timestamp('unidade_fixada_em')->nullable();
            $table->boolean('ativo')->default(true);
            $table->timestamps();
            $table->unique(['ong_id', 'identidade']);
            $table->unique(['ong_id', 'codigo_interno']);
            $table->index(['ong_id', 'ativo', 'nome']);
            $table->index(['ong_id', 'categoria_id']);
        });
        foreach (['ALIMENTACAO' => 'Alimentação', 'MEDICAMENTOS' => 'Medicamentos', 'VACINAS_PREVENCAO' => 'Vacinas e prevenção', 'HIGIENE_LIMPEZA' => 'Higiene e limpeza', 'MATERIAIS_CLINICOS' => 'Materiais clínicos', 'ACESSORIOS' => 'Acessórios', 'ACOMODACAO' => 'Acomodação', 'OUTROS' => 'Outros'] as $code => $name) {
            DB::table('inventory_categories')->insertOrIgnore(['codigo' => $code, 'nome' => $name, 'nome_chave' => mb_strtolower($name), 'escopo' => 'GLOBAL', 'ativo' => true, 'created_at' => now(), 'updated_at' => now()]);
        }
        foreach ([['UNIDADE', 'Unidade', 'un', false], ['KG', 'Quilograma', 'kg', true], ['G', 'Grama', 'g', true], ['L', 'Litro', 'L', true], ['ML', 'Mililitro', 'mL', true], ['CAIXA', 'Caixa', 'cx', false], ['PACOTE', 'Pacote', 'pct', false], ['FRASCO', 'Frasco', 'fr', false], ['DOSE', 'Dose', 'dose', false]] as [$code, $name, $symbol, $fractional]) {
            DB::table('inventory_units')->insertOrIgnore(['codigo' => $code, 'nome' => $name, 'sigla' => $symbol, 'fracionavel' => $fractional]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_products');
        Schema::dropIfExists('storage_locations');
        Schema::dropIfExists('inventory_units');
        Schema::dropIfExists('inventory_categories');
    }
};
