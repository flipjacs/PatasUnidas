"""Focused UI regression checks against local Laravel and MySQL."""
import re
from decimal import Decimal
from uuid import uuid4

import pytest
from playwright.sync_api import expect

from conftest import API_URL, BASE_URL, login


@pytest.mark.parametrize("path,heading", [
    ("/", "Cada vida merece um novo começo."),
    ("/animais", "Encontre uma companhia para a vida."),
    ("/login", "Entre na sua conta"),
    ("/cadastro", "Crie sua conta"),
    ("/transparencia", "Transparência das ONGs"),
])
def test_public_pages_load_without_javascript_errors(page, path, heading):
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE_URL + path)
    expect(page.get_by_role("heading", name=heading)).to_be_visible()
    assert not errors
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")


def test_invalid_login_has_clear_feedback(page, accounts):
    page.goto(BASE_URL + "/login")
    page.get_by_label("E-mail", exact=True).fill(accounts["admin_A"]["email"])
    page.get_by_label("Senha", exact=True).fill("senha-incorreta-qa")
    page.get_by_role("button", name="Entrar", exact=True).click()
    expect(page.get_by_role("alert")).to_contain_text("inválidos")
    assert page.url.endswith("/login")


def test_short_password_is_rejected_in_registration(page):
    page.goto(BASE_URL + "/cadastro")
    page.get_by_label("Nome completo").fill("Usuário QA")
    page.get_by_label("E-mail", exact=True).fill("qa-frontend-invalido@patas.test")
    page.get_by_label("Senha", exact=True).fill("1234567")
    page.get_by_label("Confirmar senha").fill("1234567")
    page.get_by_role("button", name=re.compile("Criar|Cadastrar")).click()
    expect(page.get_by_role("alert")).to_contain_text("8 a 72")


def test_catalog_filter_and_animal_actions_navigate(page):
    page.goto(BASE_URL + "/animais")
    page.get_by_role("button", name="Cães", exact=True).click()
    expect(page.get_by_role("button", name="Cães", exact=True)).to_have_attribute("aria-pressed", "true")
    expect(page).to_have_url(re.compile(r"/animais\?filtro=caes$"))
    card = page.locator(".animal-card").first
    expect(card).to_be_visible()
    card.click()
    expect(page.get_by_role("navigation", name=re.compile("Apoiar"))).to_be_visible()
    page.get_by_role("link", name=re.compile("^Apadrinhar ")).click()
    expect(page.get_by_role("heading", name="Entre na sua conta")).to_be_visible()


def test_financial_analysis_has_keyboard_readable_table_and_period_validation(page, accounts):
    login(page, accounts["admin_A"])
    page.goto(BASE_URL + "/ong/financeiro/analise")
    expect(page.get_by_role("heading", name="Análise de despesas")).to_be_visible()
    page.get_by_text("Ver todos os valores mensais em tabela").click()
    expect(page.get_by_role("table", name="Despesas por competência e situação financeira")).to_be_visible()
    page.get_by_label("Data inicial").fill("2026-12-01")
    page.get_by_label("Data final").fill("2026-11-01")
    page.get_by_role("button", name="Aplicar período").click()
    expect(page.get_by_role("alert")).to_contain_text("data inicial deve ser anterior")


@pytest.mark.parametrize("role,path,heading", [
    ("admin_A", "/ong/estoque/relatorios", "Relatórios de estoque"),
    ("volunteer", "/ong/estoque/movimentacoes", "Movimentações de estoque"),
    ("veterinarian", "/ong/estoque", "Estoque"),
    ("adopter", "/minha-area/doacoes", "Minhas doações"),
    ("creator", "/plataforma", "Organizações da plataforma"),
])
def test_five_profiles_restore_their_own_area(page, accounts, role, path, heading):
    login(page, accounts[role])
    page.goto(BASE_URL + path)
    expect(page.get_by_role("heading", name=heading)).to_be_visible()
    page.reload()
    expect(page.get_by_role("heading", name=heading)).to_be_visible()


@pytest.mark.parametrize("role,path", [
    ("volunteer", "/ong/financeiro/analise"),
    ("veterinarian", "/ong/financeiro"),
    ("adopter", "/ong/estoque"),
    ("creator", "/ong/estoque"),
])
def test_private_routes_reject_wrong_profile(page, accounts, role, path):
    login(page, accounts[role])
    page.goto(BASE_URL + path)
    expect(page.get_by_role("heading", name="Acesso não permitido")).to_be_visible()


def test_admin_financial_and_inventory_routes(page, accounts):
    login(page, accounts["admin_A"])
    routes = {
        "/ong/financeiro": "Financeiro",
        "/ong/financeiro/analise": "Análise de despesas",
        "/ong/estoque": "Estoque",
        "/ong/estoque/alertas": "Alertas de estoque",
        "/ong/estoque/relatorios": "Relatórios de estoque",
        "/ong/relatorios": "Relatórios da ONG",
    }
    for path, heading in routes.items():
        page.goto(BASE_URL + path)
        expect(page.get_by_role("heading", name=heading, exact=True)).to_be_visible()
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), path


def test_finance_form_persists_pending_qa_record(page, accounts):
    login(page, accounts["admin_A"])
    page.goto(BASE_URL + "/ong/financeiro/novo")
    expect(page.get_by_role("heading", name="Novo lançamento")).to_be_visible()
    marker = "QA-FRONTEND-2026 " + uuid4().hex[:8]
    page.get_by_label("Tipo", exact=True).select_option("DESPESA")
    page.get_by_label("Valor em reais").fill("12.34")
    page.get_by_label("Descrição").fill(marker)
    with page.expect_response(lambda response: "/api/v1/ong/finance/movimentacoes" in response.url and response.request.method == "POST") as write:
        page.get_by_role("button", name="Registrar pendência").click()
    assert write.value.status == 201
    result = page.get_by_text(re.compile(r"Lançamento #\d+ registrado como pendente"))
    expect(result).to_be_visible()
    movement_id = int(re.search(r"#(\d+)", result.inner_text()).group(1))
    response = page.request.get(API_URL + f"/api/v1/ong/finance/movimentacoes/{movement_id}", headers={"Origin": BASE_URL, "Accept": "application/json"})
    assert response.status == 200
    movement = response.json()
    assert movement["descricao"] == marker
    assert movement["valor"] == "12.34"
    assert movement["status"] == "PENDENTE"


@pytest.mark.parametrize("width,height", [
    (320, 568), (375, 667), (430, 932), (768, 800),
    (1024, 600), (1366, 768), (1440, 900), (900, 700),
])
def test_admin_navigation_fits_viewport(page, accounts, width, height):
    page.set_viewport_size({"width": width, "height": height})
    login(page, accounts["admin_A"])
    page.goto(BASE_URL + "/ong/estoque")
    expect(page.get_by_role("heading", name="Estoque", exact=True)).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    if width < 900:
        button = page.get_by_role("button", name="Abrir menu")
        button.click()
        expect(page.get_by_role("navigation", name="Páginas disponíveis")).to_be_visible()
        page.keyboard.press("Escape")
        expect(button).to_be_focused()
    page.goto(BASE_URL + "/ong/financeiro")
    expect(page.get_by_role("heading", name="Financeiro", exact=True)).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")


def test_admin_sidebar_last_link_is_reachable(page, accounts):
    page.set_viewport_size({"width": 1440, "height": 600})
    login(page, accounts["admin_A"])
    page.goto(BASE_URL + "/ong")
    expect(page.get_by_role("heading", name=re.compile("Olá"))).to_be_visible()
    last = page.get_by_role("link", name="Catálogo de animais")
    last.scroll_into_view_if_needed()
    expect(last).to_be_visible()
    last.click()
    expect(page.get_by_role("heading", name="Encontre uma companhia para a vida.")).to_be_visible()


def test_logout_removes_private_access(page, accounts):
    login(page, accounts["adopter"])
    page.get_by_role("button", name="Sair").click()
    page.wait_for_url(BASE_URL + "/login")
    page.goto(BASE_URL + "/minha-area")
    expect(page.get_by_role("heading", name="Entre na sua conta")).to_be_visible()


def test_other_ong_product_is_not_exposed(page, browser, accounts):
    login(page, accounts["admin_A"])
    own = page.request.get(API_URL + "/api/v1/ong/estoque/produtos", headers={"Origin": BASE_URL, "Accept": "application/json"})
    assert own.status == 200
    product_id = own.json()["data"][0]["id"]
    other_context = browser.new_context()
    try:
        other = other_context.new_page()
        login(other, accounts["admin_B"])
        foreign = other.request.get(API_URL + f"/api/v1/ong/estoque/produtos/{product_id}", headers={"Origin": BASE_URL, "Accept": "application/json"})
        assert foreign.status == 404
    finally:
        other_context.close()


def test_inventory_report_rejects_reversed_period(page, accounts):
    login(page, accounts["admin_A"])
    page.goto(BASE_URL + "/ong/estoque/relatorios")
    page.get_by_label("De", exact=True).fill("2026-12-01")
    page.get_by_label("Até", exact=True).fill("2026-11-01")
    page.get_by_role("button", name="Aplicar filtros").click()
    expect(page.get_by_text("A data final deve ser igual ou posterior à inicial.")).to_be_visible()


def test_inventory_entry_rejects_zero_quantity(page, accounts):
    login(page, accounts["admin_A"])
    page.goto(BASE_URL + "/ong/estoque/27/movimentar/entrada")
    expect(page.get_by_role("heading", name="Registrar entrada")).to_be_visible()
    page.get_by_label(re.compile(r"Quantidade \(")).fill("0")
    page.get_by_role("button", name="Registrar entrada").click()
    expect(page.get_by_text(re.compile("maior que zero"))).to_be_visible()


def test_inventory_list_recovers_from_network_error(page, accounts):
    login(page, accounts["admin_A"])
    pattern = "**/api/v1/ong/estoque/produtos?**"
    page.route(pattern, lambda route: route.abort())
    page.goto(BASE_URL + "/ong/estoque")
    expect(page.get_by_role("button", name="Tentar novamente")).to_be_visible()
    page.unroute(pattern)
    page.get_by_role("button", name="Tentar novamente").click()
    expect(page.get_by_role("table")).to_be_visible()


@pytest.mark.parametrize("role,path,status", [
    ("veterinarian", "/api/v1/ong/estoque/produtos", 200),
    ("veterinarian", "/api/v1/ong/finance/resumo", 403),
    ("adopter", "/api/v1/ong/estoque/produtos", 403),
    ("creator", "/api/v1/ong/estoque/produtos", 403),
])
def test_api_permissions_match_visible_navigation(page, accounts, role, path, status):
    login(page, accounts[role])
    response = page.request.get(API_URL + path, headers={"Origin": BASE_URL, "Accept": "application/json"})
    assert response.status == status


def test_financial_indicators_match_mysql_backed_api(page, accounts):
    login(page, accounts["admin_A"])
    page.goto(BASE_URL + "/ong/financeiro")
    expect(page.locator(".finance-summary")).to_be_visible()
    response = page.request.get(API_URL + "/api/v1/ong/finance/resumo", headers={"Origin": BASE_URL, "Accept": "application/json"})
    assert response.status == 200
    data = response.json()

    def brl(value):
        return "R$ " + f"{Decimal(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    for label, key in [("Receitas recebidas", "receitasRealizadas"),
                       ("Despesas pagas", "despesasRealizadas"),
                       ("Resultado realizado", "saldoRealizado"),
                       ("Despesas pendentes", "despesasPendentes")]:
        displayed = page.locator(".finance-summary > div").filter(has=page.get_by_text(label, exact=True)).locator("dd")
        expect(displayed).to_have_text(brl(data[key]))
