<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expense_categories', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('ong_id')->nullable();
            $table->foreign('ong_id')->references('id')->on('ong');
            $table->string('codigo', 40)->nullable()->unique();
            $table->string('nome', 100);
            $table->string('nome_chave', 100);
            $table->string('escopo', 32);
            $table->boolean('ativo')->default(true);
            $table->timestamps();
            $table->unique(['escopo', 'nome_chave']);
            $table->index(['ong_id', 'ativo']);
        });

        foreach ([
            'ALIMENTACAO' => 'Alimentação', 'MEDICAMENTOS' => 'Medicamentos',
            'CONSULTAS_VETERINARIAS' => 'Consultas veterinárias', 'VACINAS_PREVENCAO' => 'Vacinas e prevenção',
            'EXAMES' => 'Exames', 'CIRURGIAS' => 'Cirurgias', 'HIGIENE_LIMPEZA' => 'Higiene e limpeza',
            'ACESSORIOS' => 'Acessórios', 'TRANSPORTE' => 'Transporte',
            'INFRAESTRUTURA' => 'Infraestrutura', 'SERVICOS' => 'Serviços', 'OUTROS' => 'Outros',
        ] as $codigo => $nome) {
            DB::table('expense_categories')->insert([
                'codigo' => $codigo, 'nome' => $nome,
                'nome_chave' => mb_strtolower($nome), 'escopo' => 'GLOBAL',
                'ativo' => true, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        Schema::table('financial_transactions', function (Blueprint $table): void {
            $table->foreignId('categoria_id')->nullable()->constrained('expense_categories')->restrictOnDelete();
            $table->index(['ong_id', 'tipo', 'categoria_id', 'created_at'], 'finance_ong_tipo_category_created');
        });
    }

    public function down(): void
    {
        Schema::table('financial_transactions', function (Blueprint $table): void {
            $table->dropIndex('finance_ong_tipo_category_created');
            $table->dropConstrainedForeignId('categoria_id');
        });
        Schema::dropIfExists('expense_categories');
    }
};
