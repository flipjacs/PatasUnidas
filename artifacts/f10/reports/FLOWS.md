# Fluxos reais — F10.1

**PASSOU** significa resposta e estado observados pela suíte HTTP desta fase. **NÃO EXECUTADO** indica que a operação completa não foi reproduzida nesta execução; testes Laravel anteriores podem cobri-la.

| Fluxo | Perfil | Resultado | Evidência |
|---|---|---|---|
| Cadastro válido, entrada inválida e elevação de privilégio | Público | PASSOU | `test_public_registration_and_session`, `test_registration_*`: 201, 400, 409 |
| Login, restauração, logout | Cinco perfis | PASSOU | `test_five_roles_restore_session`: `/auth/me` 200 e 401 após logout |
| CSRF e acesso sem sessão | USUARIO/público | PASSOU | `test_csrf_and_private_access`: 419/401 |
| Plataforma lista ONGs | CRIADOR_PLATAFORMA | PASSOU | `test_roles_and_multi_ong`: 200 |
| Cadastro/provisionamento de ONG e primeiro administrador | CRIADOR_PLATAFORMA | NÃO EXECUTADO | Não criar instituições extras no banco de apresentação |
| Cadastro/edição de funcionário próprio | ADMINISTRADOR | NÃO EXECUTADO | Isolamento de escrita externo passou; fluxo positivo coberto pelo PHPUnit |
| Catálogo, detalhe e foto pública elegível | Público | PASSOU | `test_public_eligibility_photos_and_transparency`: 200; inelegível 404 |
| Cadastro/publicação de animal `F10-TEST` | ADMINISTRADOR | PASSOU | `test_f10_adoption_approval_race_on_new_animal`: 201/200 |
| Solicitações e aprovação exclusiva de adoção | USUARIO/ADMINISTRADOR | PASSOU | Duas solicitações 201; disputa de aprovação 200/409; uma reserva |
| Entrega e conclusão formal de adoção F10 | ADMINISTRADOR | NÃO EXECUTADO | Animal novo permanece reservado; não houve conclusão irreversível nesta fase |
| Leitura do prontuário do adotante | USUARIO | PASSOU | 200 com adoção concluída; 404 sem vínculo |
| Criação/correção clínica F10 | VETERINARIO | PASSOU | Novo animal, registro 201, correção 200, versão anterior preservada; voluntário 403 |
| Doação pendente e disputa confirmar/cancelar | USUARIO/ADMINISTRADOR | PASSOU | `test_f10_donation_confirm_cancel_race`: 201, 200/409, origem única |
| Receita e despesa manuais | VOLUNTARIO/ADMINISTRADOR | PASSOU | `test_f10_manual_finance_transitions_and_exact_balance`: 201, aprovação, confirmações e saldo decimal |
| Apadrinhamento existente ativo/encerrado | ADMINISTRADOR | PASSOU | `test_adoption_clinical_financial_and_sponsorship_state`: estados reais |
| Criação/confirmação/encerramento de apadrinhamento F10 | USUARIO/ADMINISTRADOR | PASSOU | Nova parcela 201, confirmação 200, repetição 409, encerramento 200; histórico preservado |
| Relatório financeiro e transparência publicada | ADMINISTRADOR/público | PASSOU | GET 200 e chaves públicas conferidas |
| Publicação/despublicação de demonstrativo F10 | ADMINISTRADOR | NÃO EXECUTADO | Isolamento de escrita externo passou; PHPUnit cobre fluxo positivo |
| Acesso entre ONGs | ADMINISTRADOR ONG B | PASSOU | Sete GET e seis PATCH externos retornaram 404 |

Todas as rotas visuais existentes foram percorridas por Chrome CDP; a lista com capturas está em [SCREENSHOTS.md](SCREENSHOTS.md).
