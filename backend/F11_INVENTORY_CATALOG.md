# F11.3.1: catálogo institucional de estoque

## Acesso e convenções

Base: `/api/v1/ong/estoque`. Sessão Sanctum e CSRF existentes. A ONG vem da conta autenticada. Exige conta e ONG ativas. Usuário público e criador não acessam estas rotas.

| Operação | Administrador | Voluntário | Veterinário |
| --- | --- | --- | --- |
| Consultar produtos, categorias, unidades e locais | Sim | Sim | Sim |
| Cadastrar/editar produtos | Sim | Sim | Não |
| Desativar produtos | Sim | Não | Não |
| Gerenciar categorias próprias e locais | Sim | Não | Não |

Respostas: 201 em criação, 200 em consultas/alterações; 400 para validação (padrão Laravel existente), 401 sem sessão/conta ativa, 403 sem permissão/ONG ativa, 404 recurso externo ou inexistente, 409 duplicidade ou unidade protegida. Não há DELETE, reativação, escrita de saldo nem endpoints de movimentação.

## Rotas

| Método | Caminho após a base | Finalidade |
| --- | --- | --- |
| GET | `/produtos` | Página de 15 produtos, ID decrescente, incluindo ativos e inativos |
| POST | `/produtos` | Criar produto ativo com saldo zero |
| GET | `/produtos/{produto}` | Detalhe próprio |
| PATCH | `/produtos/{produto}` | Atualização cadastral parcial |
| PATCH | `/produtos/{produto}/desativar` | Desativação lógica, corpo vazio, repetição aceita |
| GET | `/categorias` | Globais e próprias, incluindo inativas, em `{data: [...]}` |
| POST | `/categorias` | Criar categoria própria |
| PATCH | `/categorias/{categoria}` | Renomear categoria própria |
| PATCH | `/categorias/{categoria}/desativar` | Desativar própria, corpo vazio |
| GET | `/unidades` | Unidades globais somente leitura, em `{data: [...]}` |
| GET | `/locais` | Locais próprios, incluindo inativos, em `{data: [...]}` |
| POST | `/locais` | Criar local próprio |
| PATCH | `/locais/{local}` | Atualizar nome/descrição |
| PATCH | `/locais/{local}/desativar` | Desativar, corpo vazio |

## Produto: escrita

Exemplo de POST (IDs são obtidos das listas de referências):

```json
{
  "nome": "Ração para cães adultos",
  "categoriaId": 1,
  "unidadeId": 2,
  "quantidadeMinima": "20.000",
  "localId": 1,
  "marca": "Marca demonstrativa",
  "codigoInterno": "RACAO-01",
  "descricao": "Uso institucional",
  "observacoes": null
}
```

Obrigatórios no POST: nome (2–150), categoriaId e unidadeId. No PATCH, todos são opcionais. Marca: até 100; código: até 60; descrição/observações: até 2000. Strings são aparadas; código interno é normalizado para maiúsculas; opcionais textuais vazios tornam-se null. Local é opcional e pode ser removido com null. Categoria deve estar ativa e ser global ou da ONG; local informado deve estar ativo e pertencer à ONG. Vínculos já existentes com referências inativas permanecem preservados quando esses campos são omitidos na edição.

Quantidade mínima é uma string decimal não negativa, máximo `999999999.999`, até três casas. Omitida no POST, usa zero. Na API as duas quantidades sempre retornam strings com três casas. Não há cálculos em float. Unidades indivisíveis aceitam inteiros matemáticos (inclusive `2.000`), mas rejeitam `2.500`. Não há conversões automáticas.

Duplicidade: UNIQUE da ONG + hash normalizado de nome/marca/unidade. Produtos de mesmo nome com outra marca ou unidade são permitidos. Há também UNIQUE da ONG + código interno opcional. Inativos continuam reservando identidade/código. Violações concorrentes retornam 409.

Campos internos, como `ong_id`, `quantidadeDisponivel`, `quantidade_disponivel`, `ativo`, `identidade`, datas e `unidade_fixada_em`, são rejeitados no cadastro e na edição.

## Produto: resposta

```json
{
  "id": 1,
  "nome": "Ração para cães adultos",
  "marca": "Marca demonstrativa",
  "codigoInterno": "RACAO-01",
  "descricao": "Uso institucional",
  "observacoes": null,
  "categoria": {"id": 1, "nome": "Alimentação", "ativo": true, "codigo": "ALIMENTACAO", "global": true, "gerenciavel": false},
  "unidade": {"id": 2, "nome": "Quilograma", "codigo": "KG", "sigla": "kg", "fracionavel": true},
  "local": {"id": 1, "nome": "Depósito principal", "ativo": true, "descricao": null},
  "quantidadeMinima": "20.000",
  "quantidadeDisponivel": "0.000",
  "ativo": true,
  "createdAt": "timestamp retornado pelo Laravel",
  "updatedAt": "timestamp retornado pelo Laravel"
}
```

Local pode ser null. Criação, detalhe, edição e desativação retornam o objeto sem envelope; listagem usa `data`, `links` e `meta` do paginador Laravel. As relações são carregadas antecipadamente.

## Filtros

`GET /produtos?busca=ração&categoriaId=1&unidadeId=2&localId=1&ativo=1&page=1`

Todos opcionais e combináveis, aplicados no banco antes da paginação. Busca contém o nome (máximo 150 caracteres); ativo usa 1/0; page deve ser inteiro >=1. Filtros de categoria e local validam acessibilidade institucional, incluindo referências inativas para consulta histórica. IDs inválidos/inacessíveis e parâmetros desconhecidos retornam 400. Busca sem resultados retorna página vazia.

## Referências e gerenciamento

Categorias: POST/PATCH recebem somente nome (2–100). Oito globais com códigos estáveis: ALIMENTACAO, MEDICAMENTOS, VACINAS_PREVENCAO, HIGIENE_LIMPEZA, MATERIAIS_CLINICOS, ACESSORIOS, ACOMODACAO, OUTROS. Categorias próprias têm codigo null, global false e gerenciavel true apenas para o administrador. Nomes são normalizados para minúsculas em uma chave de unicidade por escopo. Globais são protegidas de edição/desativação. Não se permite criar categoria própria com o nome de uma global.

Unidades (somente leitura): UNIDADE/un, KG/kg, G/g, L/L, ML/mL, CAIXA/cx, PACOTE/pct, FRASCO/fr, DOSE/dose. Apenas KG, G, L e ML são fracionáveis.

Locais: POST recebe nome obrigatório (2–100), descrição opcional/null (até 2000); PATCH aceita os dois parcialmente. Nome único normalizado por ONG. Desativar categoria ou local não altera produtos, quantidades, finanças ou referências anteriores. Não há transferências por local nesta fase.

## Persistência e preparação da F11.4

Migration incremental `2026_11_18_195328_create_inventory_catalog`: quatro tabelas novas `inventory_products`, `inventory_categories`, `inventory_units`, `storage_locations`. FKs restringem exclusão; vínculos institucionais usam o tipo real da PK de ong. Categorias/unidades são disponibilizadas pela migration com códigos únicos e insertOrIgnore. Reexecutar migrate não duplica dados. Nenhuma tabela anterior foi reestruturada.

Saldo materializado `quantidade_disponivel DECIMAL(12,3)` com default zero, excluído do fillable e de todos os contratos de escrita. Quantidade mínima tem o mesmo tipo. As únicas atualizações atuais são cadastrais e de desativação. Não há tabela de movimentações.

O campo interno `unidade_fixada_em`, inicialmente null, prepara a proteção da unidade após a primeira movimentação. Alterar unidade exige saldo zero e esse campo null. A F11.4 deverá fixá-lo na primeira movimentação e atualizar saldo/histórico atomicamente, com lock no produto. A edição atual já bloqueia o produto em transação e valida o mínimo efetivo contra a nova unidade. Isso preserva a restrição mesmo se o mínimo não for reenviado.

Índices: ONG/ativo/nome, ONG/categoria e unicidades de identidade/código; referências usam FKs e unicidades institucionais. Não há consultas por produto para resolver referências na listagem.

## Validação local

Em 18/11/2026, via HTTP, Sanctum e MySQL local: criados produtos 1 e 2, categoria própria 9 e local 1, todos identificados por `F131-BACKEND`, na ONG demonstrativa autorizada. Ração usa KG, mínimo editado para 22.500; vermífugo usa DOSE, mínimo 10.000. Ambos com saldo 0.000. O produto clínico foi criado pelo voluntário e desativado pelo administrador. Categoria/local desativados preservaram os vínculos. Veterinário consultou e não cadastrou; segunda ONG recebeu 404 na leitura/edição e 400 em referências externas. Nenhum registro financeiro foi criado.

A F11.3.2 pode implementar o catálogo e os formulários com estes contratos. Não oferecer saldo inicial, movimentação, exclusão ou reativação, pois não há endpoints para isso.
