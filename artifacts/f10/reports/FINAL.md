# F10.1 — Relatório consolidado

## A–C. Resumo, ambiente e ferramentas

**Veredito: APROVADO COM RESSALVAS.** Os cenários executados não revelaram defeito P0/P1 aberto. A cobertura HTTP desta fase é representativa, mas não esgota todos os fluxos, combinações de permissão e concorrência em nível de banco.

Ambiente local verificado: PHP 8.5.12, Laravel 13.42.0, MySQL 8.4.13 em container Docker saudável `patas-unidas-web-mysql-1`, conexão Laravel `mysql` para `patas_unidas_web` em `127.0.0.1:3309`; backend em `127.0.0.1:8001` e frontend em `127.0.0.1:5174`, ambos HTTP 200. Treze migrations aplicadas, 84 rotas `/api/v1` registradas. Nenhuma operação destrutiva de banco foi executada.

Ferramentas: pytest + requests com sessões Sanctum reais; PHPUnit; Vitest; Pint; Vite/TypeScript; oxlint; MySQL via consultas agregadas de leitura; Google Chrome headless via CDP. **Playwright MCP não estava exposto neste ambiente e não foi utilizado.** A orientação pertinente da skill `impeccable` foi aplicada ao diagnóstico visual e à correção localizada; não houve redesign.

## D–H. Cobertura, autenticação, segurança e isolamento

- Cinco perfis demonstrativos autenticaram por cookie/CSRF e restauraram sessão com `/auth/me`; logout invalidou as sessões. Requisição protegida sem autenticação retornou 401 e POST sem token CSRF retornou 419.
- Cadastro público válido retornou 201 com `USUARIO`; entradas inválidas, campos `perfil`/`ongId`/`ong_id` e e-mail duplicado foram rejeitados. Foram criadas apenas contas públicas fictícias `F10-TEST` durante as execuções.
- A ONG B recebeu 404 para sete consultas e seis tentativas de escrita em registros da ONG A. Criador, voluntário, veterinário e usuário público tiveram acessos administrativos indevidos rejeitados nos cenários testados.
- Foto pública de animal elegível retornou 200; arquivo pela rota interna sem sessão retornou 401. O prontuário de animal adotado retornou 200 ao adotante e 404 a outro usuário. O demonstrativo público expôs somente as chaves autorizadas verificadas.
- A matriz detalhada e seus limites estão em [SECURITY.md](SECURITY.md); fluxos em [FLOWS.md](FLOWS.md).

## I–L. Adoções, clínica, finanças, plataforma e transparência

- Um animal novo `F10-TEST` recebeu duas solicitações. Duas sessões administrativas despacharam aprovações em paralelo: uma resposta 200 e outra 409. O animal ficou `EM_PROCESSO_ADOCAO` e houve uma única solicitação `APROVADA`. A entrega formal não foi repetida nesta fase.
- Um novo registro clínico foi criado pelo veterinário e corrigido com justificativa; o histórico manteve descrição anterior e nova. A tentativa de correção pelo voluntário retornou 403. O prontuário do adotante também foi consultado com vínculo real já existente.
- Doação `F10-TEST`: confirmação e cancelamento foram despachados por clientes independentes; uma operação retornou 200, a outra 409. O estado final foi único e a receita derivada foi zero ou uma conforme o resultado. Consulta SQL no MySQL encontrou **zero origens financeiras duplicadas**.
- Voluntário cadastrou receita e despesa manuais pendentes. O administrador confirmou o recebimento, aprovou a despesa e confirmou o pagamento. O saldo realizado variou exatamente **R$ 8,15**, calculado com `Decimal`; pagamento antecipado/duplicado e aprovação pelo voluntário foram rejeitados.
- Um apadrinhamento novo recebeu parcela, confirmação manual e encerramento institucional. Repetir a confirmação retornou 409; a parcela confirmada permaneceu no histórico após o encerramento.
- Após as execuções e reexecuções controladas, o MySQL contém 5 contas públicas, 5 animais, 3 doações, 6 solicitações, 6 movimentações manuais, 2 prontuários, 2 correções e 2 apadrinhamentos com marcador `F10-TEST`. Esses registros foram preservados; nenhum dado anterior foi removido.
- Criador listou ONGs; o fluxo de criação e primeiro administrador não foi repetido. Relatório financeiro e demonstrativo público publicado responderam 200; criação/publicação/despublicação de novo demonstrativo não foram repetidas. A suíte Laravel cobre os fluxos positivos adicionais em SQLite.

## M–N. Desempenho e screenshots

- Dez endpoints de leitura receberam cinco amostras sequenciais cada após aquecimento: 50 respostas 200. A maior mediana local foi a listagem de solicitações, **32,80 ms**. Detalhes em [PERFORMANCE.md](PERFORMANCE.md). Não foi calculado p95 com cinco amostras.
- Inventário de **57 rotas/telas mais 3 estados inline**, com **120 screenshots** (1440×900 e 375×812) e manifesto. Todos os pares registraram título principal, nenhum overflow horizontal e nenhuma exceção JavaScript ou `console.error` observada pelo CDP. Capturas originais locais ficam fora do Git. Veja [SCREENSHOTS.md](SCREENSHOTS.md).

## O–P. UI/UX e correções

P2 reproduzido: a página de detalhe público de animal indisponível não possuía `<h1>`, prejudicando a hierarquia para leitor de tela. Foi adicionado título específico e a página foi recapturada em desktop/mobile. Não houve mudança de contrato, autenticação ou backend.

Arquivos da F10.1: `.gitignore`; `tests/e2e_python/` (fixtures, suíte HTTP, script CDP e instruções); `artifacts/f10/manifest.json` e `artifacts/f10/reports/`; `frontend/src/features/animals/AnimalPages.tsx`; `frontend/src/styles/index.css`. Alterações locais de fases anteriores foram preservadas.

## Q. Regressão

| Verificação | Resultado |
|---|---|
| pytest HTTP real | **32 aprovados, 0 falhas** |
| PHPUnit Laravel | **173 aprovados, 1.280 assertions** |
| Vitest | **61 aprovados em 11 arquivos** |
| Pint | Aprovado |
| TypeScript + build Vite | Aprovado (`npm run build`) |
| oxlint | Aprovado |
| Migrations/rotas | 13 aplicadas; 84 rotas API |
| `git diff --check` | Aprovado |

O teste frontend existente de data civil confirmou que `2026-11-17` é exibido como `17/11/2026`.

## R–S. Pendências e veredito

Não foi instrumentada a sobreposição efetiva das transações MySQL nos dois despachos HTTP paralelos. A suíte F10 não reexecutou entrega formal da adoção, criação de ONG e primeiro administrador, cenários de conta inativa/ONG suspensa, upload de arquivo inválido, expiração temporal de sessão, publicação de novo demonstrativo nem todas as matrizes de Policy. Estados transitórios de loading e erro de rede não foram capturados. São limitações de cobertura, sem defeito P0/P1 confirmado nesta execução.

**APROVADO COM RESSALVAS:** regressões aprovadas, cinco perfis autenticados, isolamento representativo demonstrado, consistência financeira observada e inventário visual entregue. O resultado não equivale a certificação de segurança ou teste exaustivo.
