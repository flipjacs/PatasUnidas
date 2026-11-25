# Testes de navegador do frontend

Execute apenas no ambiente local de desenvolvimento, com Vite em `http://127.0.0.1:5174`, Laravel em `http://127.0.0.1:8001` e o MySQL demonstrativo. A suíte usa as contas em `/home/flipjacs/.local/share/patas-unidas-demo/` e nunca deve ser apontada para produção. Um teste cria uma despesa pendente de `R$ 12,34` com prefixo `QA-FRONTEND-2026`; o registro permanece para conferência.

```bash
python3 -m venv /tmp/patas-frontend-qa-venv
/tmp/patas-frontend-qa-venv/bin/pip install pytest playwright
/tmp/patas-frontend-qa-venv/bin/pytest -q tests/e2e/frontend
```

O navegador padrão é `/usr/bin/google-chrome` em modo headless. `PATAS_FRONTEND_URL`, `PATAS_API_URL`, `PATAS_DEMO_DIR` e `PATAS_CHROME` permitem ajustar caminhos locais. As capturas de falha ficam em `artifacts/frontend-qa/failures/`, fora do controle de versão. A exploração guiada com Playwright MCP é separada desta suíte Python.
