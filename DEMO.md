# Roteiro local de apresentação — Patas Unidas

Apresentação acadêmica de 18/11/2026. Use `http://127.0.0.1:5174` com o backend em `http://127.0.0.1:8001`. Todos os registros abaixo são fictícios e estão no MySQL local `patas_unidas_web`.

## Antes de começar

1. Siga [RUNBOOK.md](RUNBOOK.md), confirme os serviços e abra a landing em uma janela anônima.
2. Confirme que o Lar dos Bichos do Tarumã (ONG 3) e o Instituto Arumã de Proteção Animal (ONG 5) estão ativos. Esses nomes e todos os cenários são fictícios.
3. Consulte as credenciais somente nos arquivos locais de acesso restrito em `/home/flipjacs/.local/share/patas-unidas-demo/`. `f951-accounts.json` contém as contas `admin_A`, `admin_B`, `volunteer`, `veterinarian`, `adopter` e `other`; `f951-creator-password` contém apenas a senha do criador; `f98-account.json` contém o administrador da ONG 5. Não projete, copie ou imprima esses arquivos.
4. Use janelas anônimas separadas ou faça logout ao trocar de perfil. Não exiba senha, cookies, token de convite ou ferramentas de rede no projetor.

## Sequência sugerida, cerca de 15 minutos

| Etapa | Perfil e URL | Mostrar | Ação ao vivo |
| --- | --- | --- | --- |
| 1 | Visitante: `/`, `/animais`, `/animais/34` | Landing, catálogo e Bento do Lar dos Bichos do Tarumã | Filtrar catálogo e abrir detalhes |
| 2 | `adopter`: `/minha-area` | Solicitações, doações, apadrinhamentos e animais adotados | Navegar e consultar histórico; evitar nova conclusão de adoção |
| 3 | `admin_A`: `/ong` | Dashboard, animais, funcionários, adoções, financeiro, relatórios e prontuários | Filtrar tabelas e abrir registros existentes |
| 4 | `admin_A`: `/ong/apadrinhamentos/10` e `/ong/apadrinhamentos/11` | #10 encerrado com parcela confirmada; #11 mensal ativo com parcela pendente | Apenas consultar; não encerrar #11 |
| 5 | `veterinarian`: `/ong/prontuarios` | Consulta, vacina e histórico de correções de Aurora (animal 28; registros 6 e 7) | Consultar registros e correções já preparados |
| 6 | `volunteer`: `/ong` | Acesso operacional; funcionários e confirmações financeiras reservados ao administrador | Mostrar navegação disponível |
| 7 | Criador: `/plataforma` | Gestão global de ONGs fictícias, sem vínculo institucional | Consultar ONG 3 e ONG 5; não criar novo convite ao vivo |
| 8 | Visitante: `/transparencia/5/3` | Demonstrativo publicado da ONG 5 | Abrir sem sessão; explicar que é um snapshot público |

## Registros prontos

- ONGs fictícias com nomes verossímeis: Instituto Rio Negro de Proteção Animal (ID 1), Associação Patas do Japiim (ID 2), Lar dos Bichos do Tarumã (ID 3), Coletivo Patas do Mindu (ID 4) e Instituto Arumã de Proteção Animal (ID 5). Os IDs e vínculos foram mantidos para preservar contas e histórico. Os contatos usam o domínio reservado `.test`; não representam instituições existentes.
- Animais fictícios publicados da ONG 3: [Bento](http://127.0.0.1:5174/animais/34) (Golden Retriever, 30 meses), [Nina](http://127.0.0.1:5174/animais/35) (Siamês, 18 meses) e [Tito](http://127.0.0.1:5174/animais/36) (SRD de pelo curto, 24 meses). Todos têm foto ilustrativa e uma observação clínica demonstrativa. Origem e licença das fotografias: [DEMO_ASSETS.md](DEMO_ASSETS.md).
- ONG 3: Canela (animal 25, disponível, despublicado para preservar o histórico de solicitações); Estrela (26) e Aurora (28), adotados. Animais históricos com vínculos foram preservados e despublicados. Para demonstrar isolamento entre ONGs, o administrador da ONG 3 não pode acessar o animal 1 da ONG 1.
- Adoções concluídas: animais 26 e 28. Solicitações e decisões anteriores permanecem no histórico. Para Canela, a solicitação 11 está cancelada após o teste concorrente e a 12 permanece pendente. Não repita a confirmação de entrega nos animais adotados.
- Prontuário: Aurora (28), registros clínicos 6 e 7 e correções já persistidas. O adotante legítimo pode consultar o histórico de leitura.
- Financeiro da ONG 3: doações confirmadas 6 e 9; receitas realizadas 8, 9, 11 e 12; despesa paga 10. Uma doação confirmada gera uma única receita de origem automática.
- Apadrinhamento 10: encerramento institucional `ENCERRAMENTO_ONG` validado em 17/11/2026; parcela 10 permanece confirmada, com receita 12. Apadrinhamento 11: mensal ativo, parcela 11 pendente de R$ 12,34. Valor previsto não é pagamento recebido.
- Transparência: demonstrativo 3 da ONG 5, publicado. O snapshot mantém seus valores mesmo após novo lançamento financeiro. Use a URL direta acima.

## Cuidados durante a apresentação

- Prefira consultas, filtros e navegação. Aprovação de adoção, confirmação de entrega, confirmação financeira, publicação e encerramento mudam o cenário e podem ser irreversíveis.
- Se for necessário executar um formulário ao vivo, use dados fictícios novos com marcador `F99-DEMO`, confirme a ONG e o perfil antes de enviar e explique o estado pendente resultante.
- Animais demonstrativos sem foto mantêm o aviso “Fotografia indisponível”. As fotos de Bento, Nina e Tito são imagens ilustrativas, não documentação de animais reais.
- O primeiro acesso do administrador depende do comando Artisan de convite. Esse processo já foi preparado nas contas demonstrativas; não emita tokens durante a apresentação.
- O catálogo e a transparência são públicos; finanças, prontuários e dados pessoais são acessados somente por sessões autorizadas.
