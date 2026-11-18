# Segurança — F10.1

Escopo: API local `/api/v1` com MySQL de desenvolvimento e cinco contas fictícias. A suíte adicional usa sessões Sanctum, cookies e CSRF reais. Isto é evidência de cenários testados, não certificação de segurança.

| Controle | Evidência | Resultado |
|---|---|---|
| Autenticação e sessão | Login e `/auth/me` para os cinco perfis; logout seguido de `/auth/me` | 200 durante sessão, 401 após logout |
| CSRF | POST autenticado de doação sem `X-XSRF-TOKEN` | 419 |
| Perfil | Criador no financeiro, voluntário em funcionários, veterinário no financeiro, usuário público no financeiro | 403 |
| Cadastro público | Campos privilegiados `perfil`, `ongId`, `ong_id` e entrada inválida | 400; cadastro válido retorna `USUARIO` |
| Isolamento de leitura entre ONGs | Animal, funcionário, solicitação, prontuário, movimentação, apadrinhamento e demonstrativo da ONG A requisitados por administrador da ONG B | 404 |
| Isolamento de escrita entre ONGs | PATCH de animal, funcionário, adoção, doação, apadrinhamento e transparência da ONG A pela ONG B | 404, sem mudança solicitada |
| Fotografia | Arquivo de animal elegível na rota pública; rota interna sem sessão | 200 público, 401 interno |
| Prontuário do adotante | Usuário com adoção concluída e usuário sem vínculo consultam o mesmo animal | 200 e 404 |
| Transparência pública | Chaves do JSON público verificadas; dados consolidados | 200, sem dados pessoais nas chaves de topo |
| Disputa de aprovação | Dois clientes administrativos enviaram PATCH para solicitações do mesmo animal `F10-TEST` em paralelo | Um 200, um 409; uma `APROVADA`, animal reservado |
| Disputa doação | Dois clientes enviaram confirmar/cancelar doação `F10-TEST` em paralelo | Um 200, um 409; estado final único; receita condicional única |
| Financeiro manual | Voluntário cria pendências; administrador aprova/confirma; pagamento antecipado e duplicado | Transições corretas; 403/409 nos acessos inválidos; saldo varia R$ 8,15 exatos |
| Clínica e apadrinhamento F10 | Veterinário cria/corrige registro; voluntário tenta corrigir; usuário cria apoio e administrador confirma parcela/encerra | 201/200, 403, 200/409; versão clínica anterior e parcela confirmada preservadas |
| Unicidade financeira global | Consulta agregada de origens automáticas no MySQL | Zero origens com mais de um lançamento |

As requisições da disputa foram iniciadas em duas sessões HTTP independentes por `ThreadPoolExecutor`. A sobreposição efetiva das transações no MySQL não foi instrumentada; portanto, o teste confirma o resultado observado sob despacho concorrente, sem provar colisão de locks em nível de banco.

## Limites

- Esta execução não reproduziu contas inativas, ONG suspensa, expiração temporal de sessão, todos os tipos de arquivo inválido, entrega final de adoção, apoio mensal nem todas as combinações de Policy. Os 173 testes Laravel cobrem regras adicionais em SQLite.
- A suíte F10 de escrita criou apenas registros novos com marcador `F10-TEST`; não alterou entidades preparadas para apresentação.
- Não houve falha P0/P1 confirmada nos cenários executados. Cobertura incompleta não equivale a ausência de vulnerabilidades.
