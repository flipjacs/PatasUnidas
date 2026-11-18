# Desempenho local F10.1

Ambiente: PHP 8.5.12 / Laravel 13.42.0, MySQL 8.4.13 no Docker local, frontend Vite em 127.0.0.1:5174 e backend em 127.0.0.1:8001. Medições com `requests` após uma requisição de aquecimento por endpoint. Cinco amostras sequenciais por endpoint; duração observada no cliente HTTP, sem carga concorrente.

| Endpoint | Amostras | Mediana (ms) | Máximo (ms) | Erros |
|---|---:|---:|---:|---:|
| `/auth/me` | 5 | 20.27 | 20.62 | 0 |
| `/public/animais` | 5 | 23.68 | 24.59 | 0 |
| `/ong/animais` | 5 | 26.05 | 26.44 | 0 |
| `/ong/dashboard` | 5 | 27.52 | 29.38 | 0 |
| `/ong/adoption-requests` | 5 | 32.80 | 33.53 | 0 |
| `/ong/animais/28/prontuarios` | 5 | 27.00 | 27.23 | 0 |
| `/ong/finance/movimentacoes` | 5 | 30.81 | 34.49 | 0 |
| `/ong/sponsorships` | 5 | 29.61 | 31.68 | 0 |
| `/ong/relatorios/financeiro` | 5 | 22.96 | 23.87 | 0 |
| `/public/ongs/5/transparencia/3` | 5 | 21.26 | 23.19 | 0 |

Total: 50 requisições medidas em 10 endpoints. Com cinco amostras não foi calculado p95. Todos os códigos medidos foram HTTP 200.

A inspeção visual das rotas não revelou loading infinito ou layout shift evidente. Chrome CDP não registrou exceções JavaScript nem chamadas `console.error` nas 120 capturas. LCP e CLS não foram instrumentados; não há métricas inventadas. As medições representam somente o ambiente e os dados demonstrativos locais, sem valor de benchmark de produção.
