"""Capture every implemented route at desktop and mobile via local Chrome CDP.

Run with the F10 virtualenv: python tests/e2e_python/capture.py.
Screenshots are local, ignored by Git, and use fictitious demo data only.
"""
import base64
import json
import os
from pathlib import Path
import subprocess
import time
from urllib.request import urlopen

from websockets.sync.client import connect

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts/f10"
CREDS = Path(os.environ.get("F10_CREDS_DIR", "/home/flipjacs/.local/share/patas-unidas-demo"))
FRONT = os.environ.get("F10_FRONT_URL", "http://127.0.0.1:5174")


class CDP:
    def __init__(self, url):
        self.socket = connect(url, max_size=30_000_000)
        self.sequence = 0
        self.errors = []

    def call(self, method, params=None):
        self.sequence += 1
        sequence = self.sequence
        self.socket.send(json.dumps({"id": sequence, "method": method, "params": params or {}}))
        while True:
            event = json.loads(self.socket.recv())
            if event.get("method") == "Runtime.exceptionThrown":
                self.errors.append("exception")
            if event.get("method") == "Runtime.consoleAPICalled" and event.get("params", {}).get("type") == "error":
                self.errors.append("console.error")
            if event.get("id") == sequence:
                if "error" in event:
                    raise RuntimeError(event["error"])
                return event.get("result", {})

    def evaluate(self, expression):
        result = self.call("Runtime.evaluate", {"expression": expression, "returnByValue": True, "awaitPromise": True})
        return result.get("result", {}).get("value")

    def navigate(self, url):
        self.call("Page.navigate", {"url": url})
        for _ in range(40):
            time.sleep(0.1)
            if self.evaluate("document.readyState") == "complete":
                break
        for _ in range(25):
            time.sleep(0.1)
            if "Carregando página" not in (self.evaluate("document.body?.innerText") or ""):
                break
        time.sleep(0.65)

    def fill(self, selector, value):
        expression = """(()=>{const e=document.querySelector(%s);if(!e)return false;
Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,%s);
e.dispatchEvent(new Event('input',{bubbles:true}));return true})()""" % (json.dumps(selector), json.dumps(value))
        return self.evaluate(expression)


def main():
    chrome = subprocess.Popen([
        "google-chrome", "--headless=new", "--no-sandbox", "--disable-gpu",
        "--disable-dev-shm-usage", "--remote-debugging-port=9222",
        "--remote-allow-origins=*", "--user-data-dir=/tmp/patas-f10-chrome", "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):
            try:
                info = json.load(urlopen("http://127.0.0.1:9222/json/version", timeout=1))
                break
            except Exception:
                time.sleep(0.2)
        else:
            raise RuntimeError("Chrome CDP indisponível")
        browser = CDP(info["webSocketDebuggerUrl"])
        accounts = json.loads((CREDS / "f951-accounts.json").read_text())
        accounts["creator"] = {"email": "criador@patas.test", "password": (CREDS / "f951-creator-password").read_text().strip()}
        accounts["admin5"] = json.loads((CREDS / "f98-account.json").read_text())
        routes = {
            "public": [
                ("landing", "/"), ("login", "/login"), ("cadastro", "/cadastro"),
                ("primeiro-acesso", "/primeiro-acesso"), ("catalogo", "/animais"),
                ("animal-detalhe", "/animais/25"), ("animal-indisponivel", "/animais/28"),
                ("transparencia-inicio", "/transparencia"), ("transparencia-ong", "/transparencia/5"),
                ("transparencia-publicada", "/transparencia/5/3"),
            ],
            "adopter": [
                ("area-pessoal", "/minha-area"), ("solicitacoes", "/minha-area/solicitacoes"),
                ("doacoes-pessoais", "/minha-area/doacoes"), ("apadrinhamentos-pessoais", "/minha-area/apadrinhamentos"),
                ("adotados", "/minha-area/adotados"), ("prontuario-adotante", "/minha-area/adotados/28/prontuarios"),
                ("registro-adotante", "/minha-area/adotados/28/prontuarios/6"),
                ("solicitar-adocao", "/animais/25/solicitar"), ("doar", "/animais/25/doar"),
                ("apadrinhar", "/animais/25/apadrinhar"),
            ],
            "other": [("apadrinhamento-pessoal-detalhe", "/minha-area/apadrinhamentos/11")],
            "admin_A": [
                ("dashboard-admin", "/ong"), ("animais-admin", "/ong/animais"),
                ("animal-cadastro", "/ong/animais/novo"), ("animal-admin-detalhe", "/ong/animais/25"),
                ("funcionarios", "/ong/funcionarios"), ("funcionario-cadastro", "/ong/funcionarios/novo"),
                ("funcionario-detalhe", "/ong/funcionarios/23"), ("funcionario-edicao", "/ong/funcionarios/23/editar"),
                ("adocoes", "/ong/adocoes"), ("adocao-detalhe", "/ong/adocoes/12"),
                ("financeiro", "/ong/financeiro"), ("movimentacao-cadastro", "/ong/financeiro/novo"),
                ("movimentacao-detalhe", "/ong/financeiro/8"), ("doacoes-ong", "/ong/doacoes"),
                ("doacao-detalhe", "/ong/doacoes/9"), ("apadrinhamentos-ong", "/ong/apadrinhamentos"),
                ("apadrinhamento-detalhe", "/ong/apadrinhamentos/11"), ("apadrinhamento-encerrado", "/ong/apadrinhamentos/10"),
                ("relatorios", "/ong/relatorios"), ("transparencia-interna-vazia", "/ong/transparencia"),
                ("transparencia-cadastro", "/ong/transparencia/novo"),
                ("prontuarios-animais", "/ong/prontuarios"), ("prontuario-historico", "/ong/animais/28/prontuarios"),
                ("prontuario-cadastro", "/ong/animais/25/prontuarios/novo"),
                ("prontuario-detalhe", "/ong/animais/28/prontuarios/6"),
                ("prontuario-correcao", "/ong/animais/28/prontuarios/6/corrigir"),
                ("prontuario-correcoes", "/ong/animais/28/prontuarios/6/correcoes"),
            ],
            "volunteer": [("dashboard-voluntario", "/ong"), ("acesso-negado-funcionarios", "/ong/funcionarios")],
            "veterinarian": [("dashboard-veterinario", "/ong"), ("acesso-negado-financeiro", "/ong/financeiro")],
            "creator": [("plataforma", "/plataforma"), ("ong-cadastro", "/plataforma/ongs/nova"),
                        ("ong-detalhe", "/plataforma/ongs/3")],
            "admin5": [("transparencia-interna", "/ong/transparencia"),
                       ("transparencia-detalhe", "/ong/transparencia/3")],
        }
        only = os.environ.get("F10_CAPTURE_ONLY")
        manifest_path = OUT / "manifest.json"
        manifest = json.loads(manifest_path.read_text()) if only and manifest_path.is_file() else []
        for role, pages in routes.items():
            if only:
                pages = [(name, route) for name, route in pages if name == only]
            if not pages:
                continue
            context = browser.call("Target.createBrowserContext")["browserContextId"]
            target = browser.call("Target.createTarget", {"url": "about:blank", "browserContextId": context})["targetId"]
            endpoint = next(item["webSocketDebuggerUrl"] for item in json.load(urlopen("http://127.0.0.1:9222/json")) if item["id"] == target)
            page = CDP(endpoint)
            page.call("Page.enable")
            page.call("Runtime.enable")
            try:
                if role != "public":
                    account = accounts[role]
                    page.navigate(FRONT + "/login")
                    page.fill("[name=email]", account["email"])
                    page.fill("[name=senha]", account["password"])
                    page.evaluate("document.querySelector('form button[type=submit]')?.click()")
                    for _ in range(60):
                        time.sleep(0.1)
                        if page.evaluate("document.querySelector('button')?.textContent?.includes('Sair') || document.body.innerText.includes('Sair')"):
                            break
                    else:
                        raise RuntimeError(f"Login de {role} falhou")
                for name, route in pages:
                    for label, width, height in (("desktop", 1440, 900), ("mobile", 375, 812)):
                        page.call("Emulation.setDeviceMetricsOverride", {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": label == "mobile"})
                        error_start = len(page.errors)
                        page.navigate(FRONT + route)
                        title = page.evaluate("document.querySelector('h1')?.innerText || ''") or ""
                        loading = bool(page.evaluate("document.body.innerText.includes('Carregando página')"))
                        overflow = bool(page.evaluate("document.documentElement.scrollWidth > innerWidth"))
                        path = OUT / "screenshots" / ("personal" if role in ("adopter", "other") else "institutional" if role in ("admin_A", "admin5", "volunteer", "veterinarian") else "platform" if role == "creator" else "public") / f"{name}-{label}.png"
                        path.parent.mkdir(parents=True, exist_ok=True)
                        path.write_bytes(base64.b64decode(page.call("Page.captureScreenshot", {"format": "png"})["data"]))
                        record = {"screen": name, "route": route, "profile": role, "viewport": f"{width}x{height}", "file": str(path.relative_to(OUT)), "status": "CAPTURED" if title and not loading else "REVIEW", "h1": title[:100], "overflow": overflow, "jsErrors": len(page.errors) - error_start}
                        manifest = [item for item in manifest if not (item["screen"] == name and item["viewport"] == record["viewport"])]
                        manifest.append(record)
                        print(name, label, record["status"], "overflow", overflow, flush=True)
                        state_actions = {
                            "login": ("login-erro-formulario", "form button[type=submit]", "Informe seu e-mail"),
                            "ong-detalhe": ("ong-confirmacao-inline", "button.button-secondary", "Confirma"),
                            "apadrinhamento-detalhe": ("apadrinhamento-encerramento-inline", "button.button-secondary", "Justificativa do encerramento"),
                        }
                        if name in state_actions:
                            state_name, selector, expected = state_actions[name]
                            if name == "ong-detalhe":
                                selector = "button.button-secondary"
                            page.evaluate("document.querySelector(" + json.dumps(selector) + ")?.click()")
                            time.sleep(0.25)
                            observed = expected in (page.evaluate("document.body.innerText") or "")
                            if name == "ong-detalhe":
                                page.evaluate("document.querySelector('.platform-confirm')?.scrollIntoView({block:'center'})")
                            if name == "apadrinhamento-detalhe":
                                page.evaluate("document.querySelector('#sponsorship-reason')?.scrollIntoView({block:'center'})")
                            time.sleep(0.15)
                            state_path = path.with_name(f"{state_name}-{label}.png")
                            state_path.write_bytes(base64.b64decode(page.call("Page.captureScreenshot", {"format": "png"})["data"]))
                            state_record = {"screen": state_name, "route": route, "profile": role,
                                            "viewport": f"{width}x{height}", "file": str(state_path.relative_to(OUT)),
                                            "status": "CAPTURED" if observed else "REVIEW",
                                            "h1": title[:100], "overflow": bool(page.evaluate("document.documentElement.scrollWidth > innerWidth"))}
                            manifest = [item for item in manifest if not (item["screen"] == state_name and item["viewport"] == state_record["viewport"])]
                            manifest.append(state_record)
                            print(state_name, label, state_record["status"], flush=True)
            finally:
                page.socket.close()
                browser.call("Target.disposeBrowserContext", {"browserContextId": context})
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        browser.socket.close()
    finally:
        chrome.terminate()
        chrome.wait(timeout=10)


if __name__ == "__main__":
    main()
