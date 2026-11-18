"""Local HTTP fixtures. Credentials stay outside the repository."""
import json
import os
from pathlib import Path
from urllib.parse import unquote

import pytest
import requests

BASE = os.environ.get("F10_API_BASE", "http://127.0.0.1:8001")
CREDS = Path(os.environ.get("F10_CREDS_DIR", "/home/flipjacs/.local/share/patas-unidas-demo"))
HEADERS = {
    "Origin": "http://127.0.0.1:5174",
    "Referer": "http://127.0.0.1:5174/",
    "Accept": "application/json",
}


@pytest.fixture(scope="session")
def accounts():
    path = CREDS / "f951-accounts.json"
    if not path.is_file():
        pytest.skip("Arquivo local de contas demonstrativas indisponível")
    data = json.loads(path.read_text())
    creator = CREDS / "f951-creator-password"
    if creator.is_file():
        data["creator"] = {"email": "criador@patas.test", "password": creator.read_text().strip()}
    return data


def csrf(session):
    response = session.get(BASE + "/sanctum/csrf-cookie", headers=HEADERS, timeout=10)
    assert response.status_code == 204
    token = session.cookies.get("XSRF-TOKEN")
    assert token
    return unquote(token)


def login(account):
    session = requests.Session()
    token = csrf(session)
    response = session.post(
        BASE + "/api/v1/auth/login",
        json={"email": account["email"], "senha": account["password"]},
        headers={**HEADERS, "X-XSRF-TOKEN": token}, timeout=10,
    )
    assert response.status_code == 200, f"Login demonstrativo falhou: HTTP {response.status_code}"
    return session


def get(session, path):
    return session.get(BASE + "/api/v1" + path, headers=HEADERS, timeout=10)


def write(session, method, path, payload):
    return session.request(method, BASE + "/api/v1" + path, json=payload,
                           headers={**HEADERS, "X-XSRF-TOKEN": unquote(session.cookies.get("XSRF-TOKEN", ""))}, timeout=10)
