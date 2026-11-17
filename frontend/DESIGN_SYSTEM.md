# Design system — Amazônia Contemporânea

Fundação visual da F9.1, reutilizada na landing pública da F9.2.

## Direção

Verde profundo como estrutura, areia como plano de leitura, dourado natural como detalhe. A interface usa a Amazônia como referência de atmosfera e composição, sem ilustrar animais silvestres como animais disponíveis para adoção.

## Tokens

Os tokens editáveis estão em `src/styles/index.css`. Cores principais: floresta `#173D2B`, folhagem `#32664B`, areia `#F6F1E6`, terra `#A66A43`, dourado `#D7A84B`. Para textos pequenos sobre areia, a variante `--earth-ink` (`#965D39`) mantém o tom terroso com contraste adequado. Erro e sucesso têm cores próprias. A tipografia é Manrope Variable, hospedada pelo próprio build, com números tabulares quando a interface apresentar dados.

Espaçamentos, raios, sombras, largura máxima (`78rem`) e altura dos controles (`3.25rem`) também são variáveis CSS. Use os tokens antes de adicionar novas medidas. Os componentes compartilhados de marca, botão, campo, fotografia, feedback e navegação estão em `src/shared/components/Ui.tsx`.

## Padrões

- Uma ação principal por contexto; links e ações secundárias têm menor destaque.
- Botões primários, secundários, textuais e destrutivos possuem estados de foco, hover e disabled.
- Campos têm labels explícitas e erros associados ao campo quando possível.
- Cards de animais mostram foto, nome, dados essenciais e ONG. A ausência de foto é informada claramente.
- Catálogo e detalhes usam somente dados e URLs fornecidos pela API pública.
- A navegação móvel permanece ao alcance do polegar; no desktop, aparece no cabeçalho.
- A landing usa uma navbar própria em cápsula, que recolhe os links no mobile. Os destinos institucionais são seções reais da página.
- A imagem do hero é ilustrativa e identificada; os cards de animais usam somente dados e fotografias retornados pela API.
- A landing reutiliza o recorte do rio da mesma ilustração em uma pausa editorial amazônica; essa imagem não representa nenhum animal cadastrado.
- Fotografias ausentes, quebradas ou pequenas demais para um card mostram um aviso explícito. A prévia ajusta o grid à quantidade de animais reais retornados.
- As formas de cuidar são informativas até que as áreas correspondentes sejam integradas. O único CTA de encerramento leva ao catálogo real.
- O movimento da landing usa CSS para a entrada do hero e Intersection Observer para revelar seções uma vez. O conteúdo permanece visível sem JavaScript e com `prefers-reduced-motion: reduce`.
- O rodapé institucional usa o verde-floresta e reúne apenas destinos já existentes. Dados de contato ainda não foram fornecidos.
- O espaço autenticado usa o mesmo verde e a mesma areia em um shell com cabeçalho, sidebar para equipes e criador, e navegação mais leve para a conta pessoal. Menus exibem somente rotas e funções existentes; o identificador da ONG é mostrado sem inventar seu nome.
- Foco visível e movimento reduzido são tratados no CSS. Não depender apenas de cor para comunicar estado.

Referências Linea e MatDash orientam composição e organização, sem reaproveitar suas marcas, imagens ou estilos literais.
