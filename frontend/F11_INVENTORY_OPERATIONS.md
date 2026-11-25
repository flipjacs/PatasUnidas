# F11.4.2 — Frontend de movimentações e alertas

## A. Contratos

Implementação baseada na leitura integral de `backend/F11_INVENTORY_MOVEMENTS.md` e `backend/F11_INVENTORY_CATALOG.md`, com conferência do cliente HTTP, Resources e validações existentes. Validação Laravel retorna 400; também há tratamento de 422. A chave é o campo JSON `chaveOperacao`, não um header. O POST novo retorna 201 e o retry idêntico retorna 200. Nenhum código Laravel ou migration foi alterado nesta subfase.

## B. Arquitetura e navegação

Serviços tipados no cliente institucional existente; sessão, cookies, CSRF e tratamento de expiração preservados. Rotas carregadas sob demanda:

- `/ong/estoque/:id/movimentar/entrada|saida|ajuste`: formulário no contexto do produto escolhido.
- `/ong/estoque/movimentacoes`: histórico com filtros e paginação.
- `/ong/estoque/movimentacoes/:movementId`: detalhe somente leitura.
- `/ong/estoque/alertas`: consulta paginada dos quatro tipos de alerta.

Lotes permanecem no detalhe do produto, com paginação própria. Não há segunda sidebar nem novo cliente HTTP. O produto é escolhido no catálogo/detalhe antes de iniciar uma movimentação.

## C–E. Entradas, saídas e ajustes

Entradas: compra, doação física e devolução. Saídas: consumo, perda e descarte. Ajustes positivos e negativos: administrador, com confirmação nativa que informa a diferença, unidade e preservação do histórico. Todos exigem motivo; observações são opcionais.

Validação local de quantidade positiva, até três casas, limite compatível com DECIMAL(12,3), frações apenas nas unidades permitidas. Quantidades seguem como strings, sem calcular saldo em JavaScript. Campos internos e saldos não são enviados.

Produto inativo não oferece ações; o formulário também bloqueia novas operações. Conflito mostra a mensagem do servidor, preserva o formulário e recarrega produto/lotes. Após sucesso, a navegação ao detalhe consulta novamente o produto e os lotes; histórico e alertas são consultados novamente quando acessados. Não há atualização otimista nem agregados reconstruídos de páginas.

## F. Idempotência

UUID por intenção, guardado junto ao payload. Edição após erro conhecido invalida essa intenção e gera nova chave no próximo envio. Uma trava imediata por ref impede cliques duplicados, além do botão desabilitado.

Falha de rede, 5xx ou resposta de sucesso ilegível são tratados como resultado desconhecido. Nesse estado, campos ficam bloqueados e o retry usa exatamente o comando/chave anterior. Resposta 200 é sucesso legítimo. Mesmo se o produto tiver sido desativado após o envio original, o retry de reconciliação continua disponível. Há aviso ao tentar recarregar/fechar a página enquanto o resultado estiver desconhecido.

Limitação operacional explícita: a intenção fica na memória do formulário. Mantenha-o aberto até reconciliar o resultado; não há persistência de comandos em armazenamento local nem recuperação automática após fechar a aba. Nenhum token de autenticação é armazenado pelo módulo.

## G–H. Lotes e validade

Entradas/ajustes positivos aceitam quantidade sem lote, código de lote ou seleção de lote existente. Saídas/ajustes negativos selecionam lote existente ou quantidade sem lote. A seleção é paginada, preservando a opção escolhida ao trocar de página. Lotes vazios ficam indisponíveis para retirada.

`controlaValidade` integrado ao cadastro/edição do produto, protegido após `possuiMovimentacoes=true`. Produtos configurados exigem lote datado nas entradas. Consumo não oferece lote vencido; descarte permite selecioná-lo. O backend revalida tudo.

Validades são exibidas por utilitário de datas civis, sem conversão de `YYYY-MM-DD` para timestamp. A classificação de vencido usa o booleano retornado pelo servidor. A indicação local de próximo vencimento usa o dia UTC, coerente com `app.timezone` atual, e janela de 30 dias. Os alertas oficiais vêm exclusivamente da API.

## I–J. Histórico e alertas

Histórico: produto, tipo, lote, responsável e período, aplicados pelo backend antes da paginação. IDs são informados pelos detalhes do produto, lote e movimento. Datas inicial/final são inclusivas. O detalhe não oferece edição ou exclusão.

Alertas: BAIXO, ESGOTADO, VENCIDO e PROXIMO_VENCIMENTO. O total exibido vem de `meta.total`, nunca do tamanho da página. Prazo controlado de 1–365 dias. Estado vazio limitado aos critérios selecionados. Produtos sem movimentação são identificados, sem tratar saldo inicial zero como falha.

O Resource de alerta por lote não retorna unidade; a interface informa que a quantidade segue a unidade do produto e oferece acesso ao detalhe, que exibe a unidade. Não foi criado endpoint nem consulta por linha para compensar esse contrato.

## K–L. Permissões e Impeccable

Administrador: entradas, saídas, ajustes e leitura. Voluntário: entradas/saídas e leitura, sem ajuste. Veterinário: somente leitura. Guards existentes e validação interna do formulário preservados; o backend continua sendo a autoridade. Usuário público e criador permanecem fora do estoque institucional.

Skill lida: `/home/flipjacs/.agents/skills/impeccable/SKILL.md`, com aplicação do registro `reference/product.md`. Reutilizados tokens, Manrope, botões, formulários, tabelas, notices, paginador e shell existentes. Intervenção localizada: hierarquia de saldo, grupos de campos, confirmação contextual, erro junto ao campo, campos bloqueados durante resultado incerto e navegação de seções. Nenhum redesign ou biblioteca adicionada.

## M. Navegador e responsividade

Google Chrome headless via CDP; Playwright MCP não estava disponível. Interações reais com formulários, cliques por coordenadas, seleção de lotes e diálogo nativo. Não foram usados mocks nos fluxos reais.

21 verificações sem overflow horizontal: formulário, histórico e alertas em 320×568, 375×667, 430×932, 768×800, 1024×600, 1366×768 e 1440×900. Inspeção visual de capturas desktop/mobile. Drawer com rolagem interna, Escape e retorno de foco. Sidebar em 1024×600: altura 600, área rolável 1143 e último link alcançável dentro do viewport. Tab no formulário e emulação de movimento reduzido verificados. Nenhuma exceção JavaScript capturada; respostas negativas de rede/permissão eram esperadas.

Capturas locais:

- `/tmp/f142-estoque-desktop.png`
- `/tmp/f142-entrada.png`
- `/tmp/f142-saida.png`
- `/tmp/f142-ajuste.png`
- `/tmp/f142-historico.png`
- `/tmp/f142-lotes-detalhe.png`
- `/tmp/f142-alertas.png`
- `/tmp/f142-estoque-mobile.png`
- `/tmp/f142-entrada-mobile-campos.png`
- `/tmp/f142-drawer-mobile.png`
- `/tmp/f142-veterinario.png`
- `/tmp/f142-conflito.png`
- `/tmp/f142-retry-seguro.png`

Capturas não são uma auditoria WCAG exaustiva. Arquivos em /tmp podem ser removidos pelo sistema.

## N. Regressão

Vitest completo: **108 testes, 16 arquivos, sem falhas**, incluindo 17 novos testes. Build, TypeScript explícito, lint e git diff --check aprovados. Testes anteriores do catálogo, categorias, locais, financeiro, análises, adoções e área pessoal permaneceram aprovados. PHPUnit não foi reexecutado nesta subfase sem mudança Laravel; a regressão anterior registrada é 195 testes/1.570 assertions.

Bundle principal: aproximadamente 324,78 kB, 97,56 kB gzip. Novas páginas carregadas sob demanda. Nenhuma dependência instalada.

## O. Integração real — 19/11/2026

Laravel local, Sanctum, CSRF e MySQL real existentes. Registros próprios `F142-FRONTEND`:

- Produto 10, Ração operacional: entrada 25; saída 8,500; ajuste +1; ajuste -0,500; saída excessiva rejeitada; entrada 0,125; ajuste -15; voluntário entrada +1/saída -1; entrada 0,001 com resposta perdida após processamento e retry 200. Saldo final **2.126 kg**.
- Produto 11, Medicamento operacional, validade obrigatória: entrada 12 no lote 4; consumo 2; entrada 2 no lote 5 vencido; descarte 1. Saldo final **11.000 doses**, sendo lote 4 = 10.000 e lote 5 = 1.000; quantidade sem lote zero.
- Produto 12, Isolamento ONG B: saldo zero; tentativa de entrada usando lote da ONG A retornou 404, sem movimentação.

Voluntário recebeu 403 em ajuste direto. Veterinário consultou lotes/histórico e recebeu 403 em escrita. Administrador B recebeu 404 em produto/lotes externos; suas consultas de histórico/alertas não mostraram registros da ONG A.

Retry real: CDP interrompeu especificamente a resposta do POST 201 depois de processado no servidor, sem interromper apenas o preflight. A interface preservou o comando e o retry retornou 200. Foi conferida apenas uma movimentação correspondente no MySQL.

Financeiro preservado com 32 registros. Produtos anteriores não foram alterados. Evidências: `/tmp/f142-browser-results.json`, `/tmp/f142-retry-real.json`, `/tmp/f142-followup.json` e `/tmp/f142-mysql.json`. Scripts de navegador leem credenciais restritas fora do repositório; nenhuma senha, cookie ou token foi copiado para esses relatórios.

## P. Arquivos desta subfase

Modificados:

- frontend/src/app/App.tsx
- frontend/src/features/institutional/api.ts
- frontend/src/features/institutional/Inventory.tsx
- frontend/src/features/institutional/InventoryForm.tsx
- frontend/src/features/institutional/InventoryUi.tsx
- frontend/src/features/institutional/inventoryFormat.ts
- frontend/src/features/institutional/inventory.css

Criados:

- frontend/src/features/institutional/InventoryMovementForm.tsx
- frontend/src/features/institutional/InventoryHistory.tsx
- frontend/src/features/institutional/InventoryLots.tsx
- frontend/src/features/institutional/InventoryAlerts.tsx
- frontend/src/features/institutional/InventoryMovements.test.tsx
- frontend/F11_INVENTORY_OPERATIONS.md

## Q–R. Pendências e continuidade

Sem bloqueio funcional confirmado. Mantêm-se as limitações de contrato descritas acima e o cuidado de manter o formulário aberto em resultado desconhecido. Paginação com mais de 15 lotes/alertas foi exercitada nos testes automatizados; o banco real não foi preenchido artificialmente com dezenas de lotes para esse fim.

F11.5.1 pode utilizar os contratos atuais de movimentação, preservando idempotência e atomicidade. Nenhuma integração com compras, despesas ou doação material pública foi iniciada. Nenhum commit criado.
