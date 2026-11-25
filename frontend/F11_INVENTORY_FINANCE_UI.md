# F11.5.2 — Integração visual entre estoque e financeiro

## A. Contratos utilizados

Fonte principal lida integralmente: `backend/F11_INVENTORY_FINANCE.md`, complementada pelos contratos do catálogo/movimentações e pelos componentes reais existentes.

- Compra: `POST /api/v1/ong/estoque/entradas`, tipo ENTRADA_COMPRA, com despesaId opcional.
- Seleção: `GET /api/v1/ong/finance/movimentacoes?vinculavelEstoque=1&page=1&status=PENDENTE`.
- Recebimentos: `GET /api/v1/ong/estoque/movimentacoes?despesaId=36&page=1`.
- Detalhe de estoque: campo despesa null ou `{id, descricao?, status?}`.

A projeção de seleção tem id, descricao, valor decimal string, status, categoriaDespesa e createdAt. Não é tratada como transação financeira completa. Estados financeiros reais: PENDENTE, APROVADA, REALIZADA e CANCELADA; na seleção são oferecidos somente os três elegíveis retornados pelo servidor. REALIZADA é apresentada como Paga neste contexto de despesas. Validação Laravel usa 400; 422 também é tratado. Retry de movimentação pode retornar 200 ou 201, conforme o contrato anterior.

## B. Arquitetura

Reutilizados cliente HTTP, CSRF, serviços institucionais, formatação BRL, tabelas, notices, paginação e shell. Três componentes novos:

- InventoryExpensePicker: seleção opcional inline, sem modal ou pesquisa global fictícia.
- InventoryExpenseLink: vínculo somente leitura, com apresentação por perfil.
- InventoryReceipts: consulta inversa paginada dentro do detalhe financeiro.

Apenas tipos e serviços aditivos em api.ts. Não foram criadas rotas, páginas financeiras adicionais, APIs, Policies ou migrations. Backend e autenticação permanecem inalterados.

## C. Seleção

O painel só consulta despesas quando aberto. Paginação real de 15 registros; filtro opcional por estado financeiro. Não carrega todas as páginas e não simula busca por texto, pois a API não oferece busca específica.

Cada opção mostra ID, descrição, valor original, estado, data e categoria estruturada quando fornecida. Seleção permanece independente da página visível. Depois de escolher, o painel fecha e devolve o foco ao botão acionador. Remover vínculo permite continuar sem despesa.

Há carregamento, tentativa novamente, erro e estado vazio. Falha na seleção não apaga os outros campos nem impede entrada sem vínculo quando autorizada. Respostas obsoletas são ignoradas.

## D–F. Compra, doação e recebimentos parciais

Compra mostra a seção Vincular despesa financeira, explica a independência do pagamento e apresenta a referência escolhida antes de confirmar. Não exige despesa paga. O valor exibido é o da despesa original, não um custo atribuído ao recebimento.

Mudar Compra para Doação/Devolução limpa a seleção e remove despesaId do comando. Voltar a Compra exige nova escolha ou continuidade sem vínculo. Doação física utiliza os campos existentes motivo/observacoes, não exige dados do doador e informa que nenhum valor financeiro será lançado automaticamente.

A mesma despesa continua disponível para novos recebimentos. Não há controle de compra totalmente entregue, soma de custos, custo unitário ou pedido de compra.

## G–H. Histórico e consulta inversa

Histórico identifica a despesa quando presente. No detalhe, ausência de vínculo aparece como Sem despesa vinculada. O vínculo confirmado não tem ações de troca, remoção ou exclusão.

Administrador/voluntário veem somente os dados retornados e podem navegar à despesa. Veterinário vê exclusivamente o ID, sem descrição, estado, valor ou link financeiro; essa restrição visual é aplicada mesmo se dados extras forem fornecidos ao componente.

O detalhe financeiro de DESPESA ganhou Recebimentos de estoque, com produto, quantidade/unidade, data, responsável, lote e link ao movimento. A consulta envia despesaId e page ao backend. Não inclui movimentações de outras despesas nem calcula custos. O estado vazio reconhece a possibilidade de históricos antigos sem vínculo, sem afirmar que a compra nunca foi recebida.

## I. Idempotência e conflitos

Reutilizado o mecanismo da F11.4.2: UUID por intenção, trava imediata contra duplo clique, payload preservado em resultado desconhecido e retry 200 como sucesso recuperado. despesaId integra esse mesmo payload; mudar/remover a referência em uma operação ainda não confirmada invalida a intenção anterior e gera nova chave.

Após erro conhecido, o formulário preserva quantidade, motivo, lote e despesa selecionada. O usuário pode corrigir a referência. Despesa cancelada depois da seleção recebe a mensagem 409 do backend e não produz sucesso fictício. O seletor é atualizado quando reaberto após a falha.

Em falha de rede com resultado desconhecido, campos e seleção permanecem bloqueados, mantendo o mesmo payload/chave. Conserva-se a limitação operacional já documentada na F11.4.2: manter o formulário aberto até reconciliar o envio; a intenção não é recuperada automaticamente após fechar a aba. Nenhum armazenamento de tokens foi introduzido.

## J–K. Permissões e segurança

Administrador e voluntário podem selecionar despesas pela consulta reduzida existente. Voluntário não ganha acesso a análises ou relatórios administrativos. Veterinário continua em leitura de estoque, com referência mínima. Criador/usuário público continuam fora do estoque institucional pelos guards e Policies anteriores.

Não se envia ONG, funcionário, saldo ou estado financeiro no comando. Sanctum, cookies HTTP-only, CSRF e tratamento de sessão expirada foram preservados. A autoridade continua no Laravel, inclusive para referências que deixem de ser elegíveis ou pertençam a outra ONG.

## L. Impeccable

Consultados `/home/flipjacs/.agents/skills/impeccable/SKILL.md` e `reference/product.md`. Aplicação localizada: seleção inline em vez de modal, ação opcional secundária, resumo legível da referência, campos agrupados, mensagens junto à seleção e foco devolvido ao acionador. Manrope, cores/tokens, botões, tabelas responsivas e navegação existentes preservados. Não houve redesign ou nova dependência.

## M. Navegador, acessibilidade e capturas

Google Chrome headless via CDP, sem Playwright MCP. Fluxos reais executados por formulários e cliques. Seleção paginada até a página 2, retorno à primeira e escolha de despesa real.

28 verificações sem overflow horizontal nas sete resoluções: 320×568, 375×667, 430×932, 768×800, 1024×600, 1366×768 e 1440×900. Foram examinados seletor/formulário, recebimentos financeiros, histórico e detalhe de movimento. Drawer mobile rolável, Escape e retorno de foco verificados. Selecionar despesa devolveu foco ao acionador. Sidebar em 1024×600 manteve último link alcançável, com altura 600 e região rolável 1143. Movimento reduzido emulado; nenhuma animação nova foi criada. Não foram detectadas exceções JavaScript nos fluxos concluídos.

Capturas locais:

- `/tmp/f152-entrada-compra.png`
- `/tmp/f152-seletor-pagina-2.png`
- `/tmp/f152-compra-selecionada.png`
- `/tmp/f152-confirmacao.png`
- `/tmp/f152-historico.png`
- `/tmp/f152-vinculo.png`
- `/tmp/f152-recebimentos.png`
- `/tmp/f152-doacao.png`
- `/tmp/f152-seletor-mobile.png`
- `/tmp/f152-recebimentos-mobile.png`
- `/tmp/f152-vinculo-mobile.png`
- `/tmp/f152-veterinario.png`
- `/tmp/f152-voluntario-selecao.png`
- `/tmp/f152-conflito-vinculo.png`
- `/tmp/f152-retry-vinculado.png`
- `/tmp/f152-drawer-mobile.png`

As capturas de recebimentos principais precedem a entrada adicional feita após correção de conflito; o estado final possui três recebimentos vinculados. Não se trata de auditoria WCAG exaustiva.

## N. Testes e desempenho

Vitest completo: **123 testes, 17 arquivos, nenhuma falha**. Quinze testes novos cobrem seleção/páginas, opcionalidade, troca de tipo, vínculo, estado financeiro, erro 422, 403/404/409, retry com payload idêntico, nova chave após mudar despesa, dados mínimos do veterinário, consulta inversa/estado vazio, múltiplos recebimentos, duplo clique e resposta obsoleta. Os 108 testes anteriores foram preservados.

Build, lint, TypeScript explícito e git diff --check aprovados. Backend não foi alterado; PHPUnit não foi reexecutado nesta subfase frontend. A regressão backend anterior permanece registrada como 203 testes/1.708 assertions.

Bundle principal: 324,79 kB, gzip 97,57 kB. As páginas continuam sob demanda; nenhum pacote instalado. Consultas de despesas/recebimentos são paginadas e não são usadas para reconstruir agregados financeiros.

## O. Integração real e MySQL — 19/11/2026

Laravel/MySQL locais, Sanctum e CSRF existentes. Dados identificados por F152-FRONTEND, criados pelos formulários reais:

- Produtos 16 (Ração integrada, kg) e 17 (Medicamento integrado, dose).
- Despesa 36, R$ 300,00, para compra integrada. Permaneceu PENDENTE e com os mesmos dados após recebimentos.
- Despesas 37–39, R$ 1,00 cada, criadas explicitamente para completar 16 despesas elegíveis na ONG e exercitar a segunda página real sem misturar organizações. São registros de teste, não lançamentos automáticos do estoque.
- Movimento 38: entrada de 20 kg vinculada à despesa 36.
- Movimento 39: entrada de 10 doses, mesma despesa.
- Movimento 40: doação de 2 kg, sem despesaId.
- Movimento 41: entrada de 1 kg vinculada à despesa 36, após corrigir uma referência que ficou inelegível.

Para o conflito real, a despesa de teste 37 foi selecionada e depois cancelada por seu endpoint financeiro autorizado, sem SQL direto ou alteração de registros anteriores. O formulário recebeu 409, preservou seus campos, permitiu selecionar 36 e enviou outra chave. A despesa 36 não foi cancelada, aprovada ou paga.

Retry real: a resposta do POST 201 do movimento 38 foi interrompida via CDP depois do processamento; preflights foram continuados. A interface exibiu resultado desconhecido, reenviou exatamente o mesmo payload/chave e recebeu 200. O MySQL confirmou uma única movimentação com essa chave e um único vínculo correspondente.

Voluntário utilizou a seleção reduzida; análise financeira administrativa retornou 403. Veterinário viu apenas o identificador do vínculo, sem navegação/detalhes financeiros. A ONG B não recebeu despesas ou movimentos externos, e a tentativa de vincular a despesa 36 a produto próprio da ONG B retornou 404.

Estado final: produto 16 = **23.000 kg**; produto 17 = **10.000 doses**. Três entradas vinculadas à mesma despesa 36 e uma doação sem vínculo. Saldo de cada produto comparado ao somatório exato do histórico com Decimal. Lotes anteriores preservados integralmente.

Os 35 lançamentos, 37 movimentos e 15 produtos anteriores foram comparados ao snapshot inicial e permaneceram iguais. Financeiro passou a 39 registros exclusivamente pelas quatro despesas demonstrativas cadastradas explicitamente; nenhuma entrada ou doação criou lançamento. Contagens anteriores de doações financeiras, adoções e prontuários preservadas.

Evidências: `/tmp/f152-before.json`, `/tmp/f152-state.json`, `/tmp/f152-browser-results.json`, `/tmp/f152-followup.json`. Instrumentos locais `/tmp/f152-browser.py` e `/tmp/f152-followup.py`; credenciais são lidas dos arquivos restritos fora do repositório. Os relatórios não contêm senhas, cookies ou tokens de autenticação. Arquivos em /tmp podem ser removidos pelo sistema.

## P. Arquivos desta subfase

Modificados:

- frontend/src/features/institutional/api.ts
- frontend/src/features/institutional/InventoryMovementForm.tsx
- frontend/src/features/institutional/InventoryHistory.tsx
- frontend/src/features/institutional/Finance.tsx
- frontend/src/features/institutional/inventoryFormat.ts
- frontend/src/features/institutional/inventory.css

Criados:

- frontend/src/features/institutional/InventoryExpensePicker.tsx
- frontend/src/features/institutional/InventoryExpenseLink.tsx
- frontend/src/features/institutional/InventoryReceipts.tsx
- frontend/src/features/institutional/InventoryFinance.test.tsx
- frontend/F11_INVENTORY_FINANCE_UI.md

## Q–R. Limites e continuidade

Sem bloqueio funcional conhecido. Mantidas as limitações de contrato: não há busca textual de despesas, alteração de vínculo histórico, cálculo de custo unitário ou recuperação de intenção após fechar a aba em resultado desconhecido. Não foram simulados recursos inexistentes para contornar essas limitações.

Não houve alteração Laravel, migration, Policy, autenticação, schema, relatório financeiro ou fluxo de pagamento. Nenhum commit ou dependência adicionada. F11.6 não foi iniciada. A F11.6.1 pode utilizar o histórico e os vínculos já persistidos, mantendo a distinção entre evento físico e financeiro.
