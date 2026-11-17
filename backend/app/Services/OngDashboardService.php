<?php

namespace App\Services;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class OngDashboardService
{
    public function __construct(private FinancialSummaryService $finance) {}

    private function inPeriod(Builder $query, array $period, string $field, bool $dateOnly = false): Builder
    {
        if (isset($period['de'])) {
            $query->where($field, '>=', $period['de'].($dateOnly ? '' : ' 00:00:00'));
        }
        if (isset($period['ate'])) {
            $query->where($field, '<', Carbon::parse($period['ate'])->addDay()->toDateString().($dateOnly ? '' : ' 00:00:00'));
        }

        return $query;
    }

    public function dashboard(int $ongId, string $role, array $period): array
    {
        $animals = DB::table('animal')->where('ong_id', $ongId)->selectRaw(<<<'SQL'
            COUNT(*) AS total,
            SUM(CASE WHEN situacao = 'DISPONIVEL' THEN 1 ELSE 0 END) AS disponiveis,
            SUM(CASE WHEN situacao = 'INDISPONIVEL' THEN 1 ELSE 0 END) AS indisponiveis,
            SUM(CASE WHEN situacao = 'EM_PROCESSO_ADOCAO' THEN 1 ELSE 0 END) AS em_processo,
            SUM(CASE WHEN situacao = 'ADOTADO' THEN 1 ELSE 0 END) AS adotados,
            SUM(CASE WHEN situacao = 'FALECIDO' THEN 1 ELSE 0 END) AS falecidos,
            SUM(CASE WHEN publicado = 1 THEN 1 ELSE 0 END) AS publicados
            SQL)->first();
        $result = [
            'periodo' => ['de' => $period['de'] ?? null, 'ate' => $period['ate'] ?? null],
            'semanticaPeriodo' => 'Estados atuais não são históricos. O período filtra entregas, doações confirmadas, procedimentos e valores financeiros pelas respectivas datas efetivas.',
            'animais' => [
                'total' => (int) $animals->total,
                'disponiveis' => (int) $animals->disponiveis,
                'indisponiveis' => (int) $animals->indisponiveis,
                'emProcessoAdocao' => (int) $animals->em_processo,
                'adotados' => (int) $animals->adotados,
                'falecidos' => (int) $animals->falecidos,
                'publicados' => (int) $animals->publicados,
            ],
        ];

        $clinical = $this->inPeriod(DB::table('medical_records')->where('ong_id', $ongId), $period, 'data_procedimento', true)
            ->selectRaw(<<<'SQL'
                COUNT(*) AS total,
                SUM(CASE WHEN tipo = 'CONSULTA' THEN 1 ELSE 0 END) AS consultas,
                SUM(CASE WHEN tipo = 'VACINA' THEN 1 ELSE 0 END) AS vacinas,
                SUM(CASE WHEN tipo = 'EXAME' THEN 1 ELSE 0 END) AS exames,
                SUM(CASE WHEN tipo = 'CIRURGIA' THEN 1 ELSE 0 END) AS cirurgias
                SQL)->first();
        $result['clinico'] = [
            'totalRegistros' => (int) $clinical->total,
            'consultas' => (int) $clinical->consultas,
            'vacinas' => (int) $clinical->vacinas,
            'exames' => (int) $clinical->exames,
            'cirurgias' => (int) $clinical->cirurgias,
        ];

        if ($role === 'veterinario') {
            return $result;
        }

        $requests = DB::table('adoption_requests')->where('ong_id', $ongId)->selectRaw(<<<'SQL'
            SUM(CASE WHEN status = 'PENDENTE' THEN 1 ELSE 0 END) AS pendentes,
            SUM(CASE WHEN status = 'APROVADA' THEN 1 ELSE 0 END) AS aprovadas,
            SUM(CASE WHEN status = 'REJEITADA' THEN 1 ELSE 0 END) AS rejeitadas,
            SUM(CASE WHEN status = 'CANCELADA' THEN 1 ELSE 0 END) AS canceladas
            SQL)->first();
        $completed = $this->inPeriod(DB::table('adoptions')->where('ong_id', $ongId), $period, 'data_entrega')->count();
        $result['adocoes'] = [
            'solicitacoesPendentes' => (int) $requests->pendentes,
            'solicitacoesAprovadas' => (int) $requests->aprovadas,
            'solicitacoesRejeitadas' => (int) $requests->rejeitadas,
            'solicitacoesCanceladas' => (int) $requests->canceladas,
            'concluidas' => $completed,
        ];

        $sponsorships = DB::table('sponsorships')->where('ong_id', $ongId)->selectRaw(<<<'SQL'
            SUM(CASE WHEN status = 'ATIVO' THEN 1 ELSE 0 END) AS ativos,
            SUM(CASE WHEN status = 'ENCERRADO' THEN 1 ELSE 0 END) AS encerrados,
            SUM(CASE WHEN status = 'ATIVO' AND modalidade = 'UNICO' THEN 1 ELSE 0 END) AS unicos,
            SUM(CASE WHEN status = 'ATIVO' AND modalidade = 'MENSAL' THEN 1 ELSE 0 END) AS mensais
            SQL)->first();
        $installments = DB::table('sponsorship_installments as parcela')
            ->join('sponsorships as apadrinhamento', 'apadrinhamento.id', '=', 'parcela.sponsorship_id')
            ->where('apadrinhamento.ong_id', $ongId)
            ->selectRaw(<<<'SQL'
                SUM(CASE WHEN parcela.status = 'PENDENTE' THEN 1 ELSE 0 END) AS pendentes,
                SUM(CASE WHEN parcela.status = 'CONFIRMADA' THEN 1 ELSE 0 END) AS confirmadas,
                SUM(CASE WHEN parcela.status = 'PENDENTE' AND parcela.vencimento < ? THEN 1 ELSE 0 END) AS vencidas
                SQL, [today()->toDateString()])->first();
        $result['apadrinhamentos'] = [
            'ativos' => (int) $sponsorships->ativos,
            'encerrados' => (int) $sponsorships->encerrados,
            'unicosAtivos' => (int) $sponsorships->unicos,
            'mensaisAtivos' => (int) $sponsorships->mensais,
            'parcelasPendentes' => (int) $installments->pendentes,
            'parcelasConfirmadas' => (int) $installments->confirmadas,
            'parcelasVencidas' => (int) $installments->vencidas,
        ];

        if ($role === 'administrador') {
            $donations = DB::table('donations')->where('ong_id', $ongId)->selectRaw(<<<'SQL'
                SUM(CASE WHEN status = 'PENDENTE' THEN 1 ELSE 0 END) AS pendentes,
                SUM(CASE WHEN status = 'CANCELADA' THEN 1 ELSE 0 END) AS canceladas
                SQL)->first();
            $confirmed = $this->inPeriod(DB::table('donations')->where('ong_id', $ongId)
                ->where('status', 'CONFIRMADA'), $period, 'confirmado_em')
                ->selectRaw('COUNT(*) AS quantidade, COALESCE(ROUND(SUM(valor) * 100, 0), 0) AS cents')->first();
            $result['doacoes'] = [
                'pendentes' => (int) $donations->pendentes,
                'confirmadas' => (int) $confirmed->quantidade,
                'canceladas' => (int) $donations->canceladas,
                'valorConfirmado' => $this->finance->money((int) $confirmed->cents),
            ];
            $result['financeiro'] = $this->finance->summary($ongId, $period);
        }

        return $result;
    }
}
