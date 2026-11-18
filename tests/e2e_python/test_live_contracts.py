"""Local Sanctum/MySQL checks; writes create only new F10-TEST records."""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from decimal import Decimal
import statistics
import time
import uuid
import secrets
from urllib.parse import unquote

import pytest
import requests

from conftest import BASE, HEADERS, csrf, get, login, write


def test_public_registration_and_session():
    session = requests.Session()
    email = f"f10-test-{uuid.uuid4().hex[:10]}@patas.test"
    password = secrets.token_urlsafe(16)
    token = csrf(session)
    created = session.post(BASE + "/api/v1/usuarios/cadastro",
                           json={"nome": "Usuario F10-TEST", "email": email, "senha": password},
                           headers={**HEADERS, "X-XSRF-TOKEN": token}, timeout=10)
    assert created.status_code == 201
    assert created.json()["perfil"] == "USUARIO"
    assert created.json().get("ongId") is None
    bad = session.post(BASE + "/api/v1/auth/login",
                       json={"email": email, "senha": secrets.token_urlsafe(16)},
                       headers={**HEADERS, "X-XSRF-TOKEN": unquote(session.cookies.get("XSRF-TOKEN", ""))}, timeout=10)
    assert bad.status_code == 401
    valid = session.post(BASE + "/api/v1/auth/login",
                         json={"email": email, "senha": password},
                         headers={**HEADERS, "X-XSRF-TOKEN": unquote(session.cookies.get("XSRF-TOKEN", ""))}, timeout=10)
    assert valid.status_code == 200
    assert get(session, "/auth/me").json()["perfil"] == "USUARIO"


@pytest.mark.parametrize("invalid", [
    {"nome": ""}, {"email": "email-invalido"}, {"senha": "1234567"},
    {"perfil": "ADMINISTRADOR"}, {"ongId": 3}, {"ong_id": 3},
])
def test_registration_rejects_invalid_or_privileged_fields(invalid):
    session = requests.Session()
    csrf(session)
    payload = {"nome": "Usuario F10-TEST", "email": f"f10-test-{uuid.uuid4().hex[:10]}@patas.test",
               "senha": secrets.token_urlsafe(16)}
    payload.update(invalid)
    assert write(session, "POST", "/usuarios/cadastro", payload).status_code == 400


def test_registration_rejects_duplicate_email(accounts):
    session = requests.Session()
    csrf(session)
    payload = {"nome": "Usuario F10-TEST", "email": accounts["adopter"]["email"],
               "senha": secrets.token_urlsafe(16)}
    assert write(session, "POST", "/usuarios/cadastro", payload).status_code == 409


@pytest.mark.parametrize("role,profile", [
    ("creator", "CRIADOR_PLATAFORMA"), ("admin_A", "ADMINISTRADOR"),
    ("volunteer", "VOLUNTARIO"), ("veterinarian", "VETERINARIO"),
    ("adopter", "USUARIO"),
])
def test_five_roles_restore_session(accounts, role, profile):
    if role not in accounts:
        pytest.skip("Credencial demonstrativa indisponível")
    session = login(accounts[role])
    assert get(session, "/auth/me").json()["perfil"] == profile
    assert get(session, "/auth/me").status_code == 200
    logged_out = write(session, "POST", "/auth/logout", {})
    assert logged_out.status_code == 200
    assert get(session, "/auth/me").status_code == 401


def test_csrf_and_private_access(accounts):
    assert get(requests.Session(), "/ong/animais").status_code == 401
    session = login(accounts["adopter"])
    no_csrf = session.post(BASE + "/api/v1/donations", json={}, headers=HEADERS, timeout=10)
    assert no_csrf.status_code == 419
    assert get(session, "/ong/finance/resumo").status_code == 403


def test_roles_and_multi_ong(accounts):
    creator = login(accounts["creator"])
    volunteer = login(accounts["volunteer"])
    veterinarian = login(accounts["veterinarian"])
    other_ong = login(accounts["admin_B"])
    assert get(creator, "/platform/ongs").status_code == 200
    assert get(creator, "/ong/finance/resumo").status_code == 403
    assert get(volunteer, "/ong/funcionarios").status_code == 403
    assert get(veterinarian, "/ong/finance/resumo").status_code == 403
    assert get(veterinarian, "/ong/animais/28/prontuarios").status_code == 200
    for path in (
        "/ong/animais/25", "/ong/funcionarios/23", "/ong/adoption-requests/10",
        "/ong/animais/28/prontuarios/6", "/ong/finance/movimentacoes/8",
        "/ong/sponsorships/10", "/ong/transparencia/3",
    ):
        assert get(other_ong, path).status_code == 404, path


def test_multi_ong_writes_are_scoped(accounts):
    other_ong = login(accounts["admin_B"])
    cases = [
        ("PATCH", "/ong/animais/25", {"nome": "F10-TEST tentativa externa"}),
        ("PATCH", "/ong/funcionarios/23", {"nome": "F10-TEST tentativa externa"}),
        ("PATCH", "/ong/adoption-requests/10/aprovar", {}),
        ("PATCH", "/ong/donations/9/confirmar", {}),
        ("PATCH", "/ong/sponsorships/10/encerrar", {"justificativa": "F10-TEST tentativa externa"}),
        ("PATCH", "/ong/transparencia/3/publicar", {}),
    ]
    for method, path, payload in cases:
        assert write(other_ong, method, path, payload).status_code == 404, path


def test_public_eligibility_photos_and_transparency():
    public = requests.Session()
    assert get(public, "/public/animais").status_code == 200
    assert get(public, "/public/animais/25").status_code == 200
    assert get(public, "/public/animais/28").status_code == 404
    assert get(public, "/public/animais/25/fotos/4/arquivo").status_code == 200
    report = get(public, "/public/ongs/5/transparencia/3")
    assert report.status_code == 200
    assert set(report.json()) == {"id", "ong", "titulo", "descricao", "periodoInicio", "periodoFim", "publicadoEm", "dados"}
    assert report.json()["dados"]["resultadoLiquido"] == "0.00"
    assert get(public, "/ong/animais/25/fotos/4/arquivo").status_code == 401


def test_adoption_clinical_financial_and_sponsorship_state(accounts):
    admin = login(accounts["admin_A"])
    adopter = login(accounts["adopter"])
    outsider = login(accounts["other"])
    animal = get(admin, "/ong/animais/25").json()
    assert animal["situacao"] == "DISPONIVEL" and animal["publicado"] is True
    assert get(admin, "/ong/adoption-requests/12").json()["status"] == "PENDENTE"
    assert get(adopter, "/me/animais-adotados/28/prontuarios").status_code == 200
    assert get(outsider, "/me/animais-adotados/28/prontuarios").status_code == 404
    assert get(admin, "/ong/animais/28/prontuarios/6/correcoes").status_code == 200
    closed = get(admin, "/ong/sponsorships/10").json()
    assert closed["status"] == "ENCERRADO"
    active = get(admin, "/ong/sponsorships/11").json()
    assert active["status"] == "ATIVO"
    assert get(admin, "/ong/finance/resumo").status_code == 200
    assert get(admin, "/ong/donations").status_code == 200


def test_f10_adoption_approval_race_on_new_animal(accounts):
    admin = login(accounts["admin_A"])
    animal = write(admin, "POST", "/ong/animais", {
        "nome": f"F10-TEST adocao {uuid.uuid4().hex[:8]}", "especie": "CACHORRO",
        "sexo": "MACHO", "porte": "MEDIO", "idade_aproximada": 18,
    })
    assert animal.status_code == 201
    animal_id = animal.json()["id"]
    assert write(admin, "PATCH", f"/ong/animais/{animal_id}/publicar", {}).status_code == 200
    candidates = [login(accounts[role]) for role in ("adopter", "other")]
    requests_ids = []
    for candidate in candidates:
        response = write(candidate, "POST", "/adoption-requests", {
            "animalId": animal_id, "mensagem": "F10-TEST disputa controlada",
        })
        assert response.status_code == 201
        requests_ids.append(response.json()["id"])
    admins = [admin, login(accounts["admin_A"])]
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(write, account, "PATCH", f"/ong/adoption-requests/{request_id}/aprovar", {})
                   for account, request_id in zip(admins, requests_ids)]
        statuses = sorted(f.result().status_code for f in futures)
    assert statuses == [200, 409]
    assert get(admin, f"/ong/animais/{animal_id}").json()["situacao"] == "EM_PROCESSO_ADOCAO"
    states = [get(admin, f"/ong/adoption-requests/{request_id}").json()["status"] for request_id in requests_ids]
    assert states.count("APROVADA") == 1 and states.count("PENDENTE") == 1


def test_f10_donation_confirm_cancel_race(accounts):
    donor = login(accounts["adopter"])
    admin = login(accounts["admin_A"])
    ong_id = get(admin, "/auth/me").json()["ongId"]
    created = write(donor, "POST", "/donations", {
        "ongId": ong_id, "valor": "25.50", "mensagem": "F10-TEST disputa controlada",
    })
    assert created.status_code == 201
    donation_id = created.json()["id"]
    with ThreadPoolExecutor(max_workers=2) as pool:
        confirmed = pool.submit(write, admin, "PATCH", f"/ong/donations/{donation_id}/confirmar", {})
        canceled = pool.submit(write, donor, "PATCH", f"/me/donations/{donation_id}/cancelar", {})
        statuses = sorted([confirmed.result().status_code, canceled.result().status_code])
    assert statuses == [200, 409]
    state = get(admin, f"/ong/donations/{donation_id}").json()["status"]
    assert state in ("CONFIRMADA", "CANCELADA")
    revenue = get(admin, "/ong/finance/movimentacoes?categoria=DOACAO&status=REALIZADA").json()["data"]
    matching = [row for row in revenue if row["origem"] == {"tipo": "DOACAO", "id": donation_id}]
    assert len(matching) == (1 if state == "CONFIRMADA" else 0)
    if matching:
        assert matching[0]["valor"] == "25.50" and matching[0]["status"] == "REALIZADA"


def test_f10_manual_finance_transitions_and_exact_balance(accounts):
    admin = login(accounts["admin_A"])
    volunteer = login(accounts["volunteer"])
    before = get(admin, "/ong/finance/resumo").json()
    revenue = write(volunteer, "POST", "/ong/finance/movimentacoes", {
        "tipo": "RECEITA", "categoria": "EVENTO", "descricao": "F10-TEST receita controlada", "valor": "11.25",
    })
    expense = write(volunteer, "POST", "/ong/finance/movimentacoes", {
        "tipo": "DESPESA", "categoria": "ALIMENTACAO", "descricao": "F10-TEST despesa controlada", "valor": "3.10",
    })
    assert revenue.status_code == expense.status_code == 201
    revenue_id, expense_id = revenue.json()["id"], expense.json()["id"]
    assert get(admin, "/ong/finance/resumo").json()["saldoRealizado"] == before["saldoRealizado"]
    assert write(admin, "PATCH", f"/ong/finance/movimentacoes/{expense_id}/confirmar-pagamento", {}).status_code == 409
    assert write(volunteer, "PATCH", f"/ong/finance/movimentacoes/{expense_id}/aprovar", {}).status_code == 403
    assert write(admin, "PATCH", f"/ong/finance/movimentacoes/{expense_id}/aprovar", {}).json()["status"] == "APROVADA"
    assert get(admin, "/ong/finance/resumo").json()["saldoRealizado"] == before["saldoRealizado"]
    assert write(admin, "PATCH", f"/ong/finance/movimentacoes/{revenue_id}/confirmar-recebimento", {}).json()["status"] == "REALIZADA"
    assert write(admin, "PATCH", f"/ong/finance/movimentacoes/{expense_id}/confirmar-pagamento", {}).json()["status"] == "REALIZADA"
    assert write(admin, "PATCH", f"/ong/finance/movimentacoes/{expense_id}/confirmar-pagamento", {}).status_code == 409
    after = get(admin, "/ong/finance/resumo").json()
    assert Decimal(after["saldoRealizado"]) - Decimal(before["saldoRealizado"]) == Decimal("8.15")


def test_f10_clinical_correction_and_sponsorship_history(accounts):
    admin = login(accounts["admin_A"])
    vet = login(accounts["veterinarian"])
    volunteer = login(accounts["volunteer"])
    sponsor = login(accounts["adopter"])
    animal = write(admin, "POST", "/ong/animais", {
        "nome": f"F10-TEST clinico {uuid.uuid4().hex[:8]}", "especie": "GATO",
        "sexo": "FEMEA", "porte": "PEQUENO", "idade_aproximada": 8,
    })
    assert animal.status_code == 201
    animal_id = animal.json()["id"]
    assert write(admin, "PATCH", f"/ong/animais/{animal_id}/publicar", {}).status_code == 200
    clinical = write(vet, "POST", f"/ong/animais/{animal_id}/prontuarios", {
        "tipo": "CONSULTA", "titulo": "F10-TEST avaliação", "descricao": "Avaliação inicial",
        "dataProcedimento": (date.today() - timedelta(days=1)).isoformat(),
    })
    assert clinical.status_code == 201
    record_id = clinical.json()["id"]
    assert get(volunteer, f"/ong/animais/{animal_id}/prontuarios/{record_id}").status_code == 200
    assert write(volunteer, "PATCH", f"/ong/animais/{animal_id}/prontuarios/{record_id}/corrigir", {
        "descricao": "Invasão F10-TEST", "justificativa": "Tentativa proibida",
    }).status_code == 403
    corrected = write(vet, "PATCH", f"/ong/animais/{animal_id}/prontuarios/{record_id}/corrigir", {
        "descricao": "Avaliação revisada F10-TEST", "justificativa": "Correção clínica F10-TEST",
    })
    assert corrected.status_code == 200
    assert corrected.json()["descricao"] == "Avaliação revisada F10-TEST"
    history = get(admin, f"/ong/animais/{animal_id}/prontuarios/{record_id}/correcoes").json()["data"]
    assert len(history) == 1
    assert history[0]["dadosAnteriores"]["descricao"] == "Avaliação inicial"
    assert history[0]["dadosNovos"]["descricao"] == "Avaliação revisada F10-TEST"
    support = write(sponsor, "POST", "/sponsorships", {
        "animalId": animal_id, "modalidade": "UNICO", "valor": "12.34",
    })
    assert support.status_code == 201
    sponsorship_id = support.json()["id"]
    installment_id = support.json()["primeiraParcela"]["id"]
    assert write(volunteer, "PATCH", f"/ong/sponsorships/{sponsorship_id}/parcelas/{installment_id}/confirmar", {}).status_code == 403
    confirmed = write(admin, "PATCH", f"/ong/sponsorships/{sponsorship_id}/parcelas/{installment_id}/confirmar", {})
    assert confirmed.status_code == 200 and confirmed.json()["status"] == "CONFIRMADA"
    assert write(admin, "PATCH", f"/ong/sponsorships/{sponsorship_id}/parcelas/{installment_id}/confirmar", {}).status_code == 409
    closed = write(admin, "PATCH", f"/ong/sponsorships/{sponsorship_id}/encerrar", {
        "justificativa": "Encerramento controlado F10-TEST",
    })
    assert closed.status_code == 200 and closed.json()["status"] == "ENCERRADO"
    installments = get(admin, f"/ong/sponsorships/{sponsorship_id}/parcelas").json()["data"]
    assert len(installments) == 1 and installments[0]["status"] == "CONFIRMADA"


@pytest.mark.parametrize("path,role", [
    ("/auth/me", "admin_A"), ("/public/animais", None),
    ("/ong/animais", "admin_A"), ("/ong/dashboard", "admin_A"),
    ("/ong/adoption-requests", "admin_A"), ("/ong/animais/28/prontuarios", "admin_A"),
    ("/ong/finance/movimentacoes", "admin_A"), ("/ong/sponsorships", "admin_A"),
    ("/ong/relatorios/financeiro", "admin_A"),
    ("/public/ongs/5/transparencia/3", None),
])
def test_light_read_performance(accounts, path, role, record_property):
    session = login(accounts[role]) if role else requests.Session()
    get(session, path)  # warmup
    timings = []
    statuses = []
    for _ in range(5):
        start = time.perf_counter()
        response = get(session, path)
        timings.append((time.perf_counter() - start) * 1000)
        statuses.append(response.status_code)
    record_property(path, {"samples": 5, "median_ms": round(statistics.median(timings), 2),
                           "max_ms": round(max(timings), 2), "errors": sum(code != 200 for code in statuses)})
    assert statuses == [200] * 5
