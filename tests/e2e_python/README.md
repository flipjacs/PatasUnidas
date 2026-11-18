# Testes locais F10.1

Execute somente no MySQL local de desenvolvimento com os dados demonstrativos F951, F96, F97 e F98. A suíte faz requisições HTTP reais; alguns testes criam registros novos identificados por `F10-TEST` e não os removem. Não use em produção ou em banco compartilhado.

Serviços esperados: Laravel em `http://127.0.0.1:8001`, Vite em `http://127.0.0.1:5174` e MySQL local. As credenciais devem estar fora do repositório em `/home/flipjacs/.local/share/patas-unidas-demo/`, ou em `F10_CREDS_DIR`, com arquivos `f951-accounts.json` e `f951-creator-password` protegidos. A suíte não imprime as senhas.

```sh
python3 -m venv /tmp/patas-f10-venv
/tmp/patas-f10-venv/bin/pip install pytest requests websockets
/tmp/patas-f10-venv/bin/pytest -q tests/e2e_python/test_live_contracts.py -o junit_family=legacy --junitxml=artifacts/f10/test-results/pytest.xml
/tmp/patas-f10-venv/bin/python tests/e2e_python/capture.py
```

O inventário visual usa Google Chrome headless via CDP na porta 9222 e grava `artifacts/f10/manifest.json`. As capturas e logs locais em `artifacts/f10/screenshots/` e `artifacts/f10/test-results/` são ignorados pelo Git. Para recapturar uma tela específica, use `F10_CAPTURE_ONLY=<nome-da-tela>`.

Os IDs demonstrativos atuais são específicos deste banco. Em outro banco, prepare os mesmos cenários ou adapte os IDs dos testes antes de executar. Não altere os endpoints nem desative CSRF para contornar dados ausentes.
