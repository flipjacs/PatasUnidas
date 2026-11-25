"""Browser fixtures for the local Patas Unidas frontend audit."""
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

import pytest
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("PATAS_FRONTEND_URL", "http://127.0.0.1:5174")
API_URL = os.environ.get("PATAS_API_URL", "http://127.0.0.1:8001")
DEMO_DIR = Path(os.environ.get("PATAS_DEMO_DIR", "/home/flipjacs/.local/share/patas-unidas-demo"))


class RedactedAccounts:
    def __init__(self, values):
        self._values = values

    def __getitem__(self, key):
        return self._values[key]

    def __repr__(self):
        return "<contas demonstrativas protegidas>"


@pytest.fixture(scope="session")
def accounts():
    path = DEMO_DIR / "f951-accounts.json"
    if not path.is_file():
        pytest.skip("Contas demonstrativas locais indisponíveis")
    data = json.loads(path.read_text())
    creator = DEMO_DIR / "f951-creator-password"
    if creator.is_file():
        data["creator"] = {"email": "criador@patas.test", "password": creator.read_text().strip()}
    return RedactedAccounts(data)


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=os.environ.get("PATAS_CHROME", "/usr/bin/google-chrome"),
            args=["--no-sandbox"],
        )
        yield browser
        browser.close()


@pytest.fixture
def page(browser, request):
    context = browser.new_context(viewport={"width": 1366, "height": 768})
    page = context.new_page()
    yield page
    if request.node.rep_call.failed:
        output = Path("artifacts/frontend-qa/failures")
        output.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(output / (request.node.name.replace("/", "_") + ".png")), full_page=True)
    context.close()


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    setattr(item, "rep_" + report.when, report)


def login(page, account):
    errors = []
    failed = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("requestfailed", lambda request: failed.append(urlsplit(request.url).path))
    page.on("response", lambda response: failed.append(f"{response.status} {urlsplit(response.url).path}") if response.status >= 400 else None)
    page.goto(BASE_URL + "/login")
    try:
        page.get_by_role("heading", name="Entre na sua conta").wait_for(timeout=5000)
    except PlaywrightTimeoutError:
        output = Path("artifacts/frontend-qa")
        output.mkdir(parents=True, exist_ok=True)
        diagnostic = {"url": page.url, "readyState": page.evaluate("document.readyState"),
                      "rootLength": page.evaluate("document.getElementById('root')?.innerHTML.length || 0"),
                      "errors": errors, "failed": failed}
        with (output / "transient-loads.jsonl").open("a") as file:
            file.write(json.dumps(diagnostic, ensure_ascii=False) + "\n")
        page.reload()
        page.get_by_role("heading", name="Entre na sua conta").wait_for(timeout=10000)
    page.get_by_label("E-mail", exact=True).fill(account["email"])
    page.get_by_label("Senha", exact=True).fill(account["password"])
    page.get_by_role("button", name="Entrar", exact=True).click()
    page.wait_for_url(lambda url: not str(url).endswith("/login"))
    return page.url
