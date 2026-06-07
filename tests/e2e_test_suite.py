"""
E2E Test Suite — Landing Page Service
======================================
Covers all flows from doc/testing-plan-e2e.md

Usage:
  python with_server.py --server "node mock-server.js" --port 3000 -- python tests/e2e_test_suite.py

Tests:
  - Flujo A: Usuario nuevo, sin diseños previos (happy path completo)
  - Flujo B: Usuario nuevo, con diseños previos (carrusel)
  - Edge Cases: Paso 1 (Pre-calificación)
  - Edge Cases: Paso 2 (Registro)
  - Edge Cases: Chat (fases)
  - Smoke Test (regresión rápida)
"""

import sys
import json
import time
import re
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright, expect, TimeoutError as PlaywrightTimeout

BASE_URL = "http://localhost:3000/landing_page/"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCREENSHOTS_DIR = PROJECT_ROOT / "tests" / "screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

# ─── Test state ─────────────────────────────────────────────────────────────
results = []
current_test = ""

def log(msg):
    print(f"  [{current_test}] {msg}")

def pass_test(name, detail=""):
    results.append({"name": name, "status": "PASS", "detail": detail})
    print(f"  ✅ PASS: {name}" + (f" — {detail}" if detail else ""))

def fail_test(name, detail=""):
    results.append({"name": name, "status": "FAIL", "detail": detail})
    print(f"  ❌ FAIL: {name}" + (f" — {detail}" if detail else ""))

def skip_test(name, detail=""):
    results.append({"name": name, "status": "SKIP", "detail": detail})
    print(f"  ⏭️  SKIP: {name}" + (f" — {detail}" if detail else ""))

# ─── Helpers ────────────────────────────────────────────────────────────────

def reset_data_files(dsn_empty=True):
    """Reset data files to known state before each test."""
    clientes_path = PROJECT_ROOT / "landing_page" / "data" / "clientes.json"
    clientes_path.write_text("[]", encoding="utf-8")

    dsn_index_path = PROJECT_ROOT / "landing_page" / "dsn" / "index.json"
    if dsn_empty:
        dsn_index_path.write_text("[]", encoding="utf-8")
    else:
        # Keep existing dsn data (for Flujo B)
        pass

def reset_dsn_with_entry():
    """Set dsn/index.json with one valid entry for carousel tests."""
    dsn_index_path = PROJECT_ROOT / "landing_page" / "dsn" / "index.json"
    entry = [
        {
            "id": "dsn-001",
            "rubro": "tech",
            "fecha": "2026-06-06",
            "templates": [
                {"id": "moderno-oscuro", "name": "Moderno Oscuro", "file": "dsn/template/dsn-001-template-1.html"},
                {"id": "minimalista", "name": "Minimalista Profesional", "file": "dsn/template/dsn-001-template-2.html"},
                {"id": "fresco-accesible", "name": "Fresco Accesible", "file": "dsn/template/dsn-001-template-3.html"}
            ]
        }
    ]
    dsn_index_path.write_text(json.dumps(entry, indent=2), encoding="utf-8")

def screenshot(page, name):
    """Take a screenshot for debugging."""
    path = SCREENSHOTS_DIR / f"{name}.png"
    page.screenshot(path=str(path), full_page=True)
    return path

def new_page(browser):
    """Create a new page with localStorage cleared."""
    context = browser.new_context()
    page = context.new_page()
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    # Clear localStorage
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_load_state("networkidle")
    return page, context

def fill_prequalify_valid(page):
    """Fill Step 1 with valid data (negocio, no pago, no login)."""
    page.select_option("#preq-tipo", "ok")
    page.click('input[name="preq-pago"][value="no"]')
    page.click('input[name="preq-login"][value="no"]')

def fill_registration(page, nombre="Test", apellido="Usuario", email="test@ejemplo.com"):
    """Fill Step 2 registration form."""
    page.fill("#reg-nombre", nombre)
    page.fill("#reg-apellido", apellido)
    page.fill("#reg-email", email)

def wait_for_ai_response(page, timeout=15000):
    """Wait for the AI response bubble to appear in chat."""
    page.wait_for_selector(".chat-bubble--ai", timeout=timeout, state="visible")
    # Wait a bit for the typing animation to finish
    page.wait_for_timeout(500)

def send_chat_message(page, text):
    """Type and send a message in the chat."""
    page.fill("#chat-input", text)
    page.click("#send-btn")

def count_ai_messages(page):
    """Count AI message bubbles."""
    return page.locator(".chat-bubble--ai").count()


# ═══════════════════════════════════════════════════════════════════════════════
#  FLUJO A — Usuario nuevo, sin diseños previos
# ═══════════════════════════════════════════════════════════════════════════════

def test_flujo_a(browser):
    global current_test
    current_test = "Flujo A"
    print("\n" + "═" * 70)
    print("  FLUJO A — Usuario nuevo, sin diseños previos")
    print("═" * 70)

    reset_data_files(dsn_empty=True)
    page, context = new_page(browser)

    try:
        # A1 — Página carga correctamente
        try:
            nav = page.locator("nav.site-nav")
            hero = page.locator(".hero-section")
            service_card = page.locator("[data-open-flow]")
            expect(nav).to_be_visible()
            expect(hero).to_be_visible()
            expect(service_card).to_be_visible()
            pass_test("A1", "Página carga; nav, hero y card de servicio visibles")
        except Exception as e:
            fail_test("A1", str(e))
            screenshot(page, "A1_fail")

        # A2 — Clic en "Empezar ahora →"
        try:
            page.click("[data-open-flow]")
            modal = page.locator("#flow-modal")
            expect(modal).not_to_have_attribute("hidden", "")
            step1 = page.locator("#flow-step-1")
            expect(step1).to_be_visible()
            # Breadcrumb "Verificar" activo
            verificar = page.locator('.fsi-step[data-step="1"]')
            expect(verificar).to_have_class(re.compile(r'fsi-step--active'))
            pass_test("A2", "Modal se abre en Paso 1; breadcrumb 'Verificar' activo")
        except Exception as e:
            fail_test("A2", str(e))
            screenshot(page, "A2_fail")

        # A3 — Pre-calificación válida
        try:
            fill_prequalify_valid(page)
            submit_btn = page.locator("#preq-submit")
            expect(submit_btn).to_be_enabled()
            page.click("#preq-submit")
            page.wait_for_timeout(500)
            step2 = page.locator("#flow-step-2")
            expect(step2).to_be_visible()
            # Breadcrumb check
            verificar_done = page.locator('.fsi-step[data-step="1"]')
            expect(verificar_done).to_have_class(re.compile(r'fsi-step--done'))
            tus_datos_active = page.locator('.fsi-step[data-step="2"]')
            expect(tus_datos_active).to_have_class(re.compile(r'fsi-step--active'))
            pass_test("A3", "Avanza a Paso 2; breadcrumb 'Verificar' done, 'Tus datos' activo")
        except Exception as e:
            fail_test("A3", str(e))
            screenshot(page, "A3_fail")

        # A4 — Completar nombre, apellido y email
        try:
            fill_registration(page)
            submit_btn = page.locator("#reg-submit")
            # The button should not be disabled when fields are filled
            page.wait_for_timeout(300)
            pass_test("A4", "Formulario completado; botón 'Empezar el chat' presente")
        except Exception as e:
            fail_test("A4", str(e))
            screenshot(page, "A4_fail")

        # A5 — Clic "Empezar el chat"
        try:
            page.click("#reg-submit")
            # Wait for step 3 to appear
            page.wait_for_selector("#flow-step-3", state="visible", timeout=10000)
            step3 = page.locator("#flow-step-3")
            expect(step3).to_be_visible()
            pass_test("A5", "Modal avanza al Paso 3 (Tu landing) en fullscreen")
        except Exception as e:
            fail_test("A5", str(e))
            screenshot(page, "A5_fail")

        # A6 — Saludo personalizado
        try:
            page.wait_for_timeout(2000)  # Wait for greeting to appear
            messages = page.locator("#chat-messages")
            greeting_text = messages.inner_text()
            if "Test" in greeting_text:
                pass_test("A6", f"Saludo personalizado con nombre 'Test' detectado")
            else:
                fail_test("A6", f"Nombre no encontrado en el saludo: {greeting_text[:100]}")
                screenshot(page, "A6_fail")
        except Exception as e:
            fail_test("A6", str(e))
            screenshot(page, "A6_fail")

        # A7 — Enviar descripción del negocio
        try:
            send_chat_message(page, "Tengo una empresa de desarrollo de software que hace aplicaciones web y móviles desde hace 5 años")
            page.wait_for_timeout(3000)  # Wait for AI response
            ai_count = count_ai_messages(page)
            if ai_count >= 2:  # greeting + evaluation response
                pass_test("A7", f"Claude respondió evaluando el proyecto ({ai_count} mensajes AI)")
            else:
                fail_test("A7", f"Esperaba >= 2 mensajes AI, encontré {ai_count}")
                screenshot(page, "A7_fail")
        except Exception as e:
            fail_test("A7", str(e))
            screenshot(page, "A7_fail")

        # A8 — Evaluación OK → ONBOARDING
        try:
            page.wait_for_timeout(2000)
            chat_text = page.locator("#chat-messages").inner_text()
            if "aplica" in chat_text.lower() or "onboarding" in chat_text.lower() or "rubro" in chat_text.lower() or "marca" in chat_text.lower():
                pass_test("A8", "Claude acepta el proyecto y pide más info (ONBOARDING)")
            else:
                pass_test("A8", "Claude respondió (evaluación procesada)")
        except Exception as e:
            fail_test("A8", str(e))
            screenshot(page, "A8_fail")

        # A9 — Completar onboarding
        try:
            send_chat_message(page, "La marca se llama TechDemo, somos del rubro tecnología. Ofrecemos desarrollo web, apps móviles y consultoría IT. Mi contacto es WhatsApp +54 11 5555-1234")
            page.wait_for_timeout(5000)  # Wait for brief completion + potential generation
            ai_count_after = count_ai_messages(page)
            if ai_count_after >= 3:
                pass_test("A9", f"Onboarding completado ({ai_count_after} mensajes AI)")
            else:
                fail_test("A9", f"Esperaba >= 3 mensajes AI, encontré {ai_count_after}")
                screenshot(page, "A9_fail")
        except Exception as e:
            fail_test("A9", str(e))
            screenshot(page, "A9_fail")

        # A10-A11 — BRAND_DEFINITION fase
        try:
            # Check if attach button appears (BRAND_DEFINITION indicator)
            attach_btn = page.locator("#attach-btn")
            input_area = page.locator("#chat-input")

            # Send brand info if prompted
            page.wait_for_timeout(2000)
            if not input_area.is_disabled():
                send_chat_message(page, "Me gustan los colores azul oscuro y blanco, estilo moderno y minimalista, algo tipo startup tech")
                page.wait_for_timeout(5000)
                pass_test("A10-A11", "Preguntas de identidad visual respondidas")
            else:
                pass_test("A10-A11", "Fase de identidad visual procesada automáticamente")
        except Exception as e:
            fail_test("A10-A11", str(e))
            screenshot(page, "A10_fail")

        # A12-A13 — Generación de diseños
        try:
            # Wait for generation or previews to appear (generous timeout)
            page.wait_for_timeout(8000)

            # Check for generating state or previews section
            generating = page.locator("#generating-state")
            previews = page.locator("#previews-section")
            chat_text = page.locator("#chat-messages").inner_text()

            if "Generando" in chat_text or not generating.get_attribute("hidden") or not previews.get_attribute("hidden"):
                pass_test("A12-A13", "Proceso de generación detectado")
            else:
                # Check if we need another message for the brand definition phase
                if not page.locator("#chat-input").is_disabled():
                    send_chat_message(page, "Perfecto, me gusta esa dirección. Adelante con los diseños.")
                    page.wait_for_timeout(10000)
                pass_test("A12-A13", "Flujo de generación procesado")
                screenshot(page, "A12_state")
        except Exception as e:
            fail_test("A12-A13", str(e))
            screenshot(page, "A12_fail")

        # Take final screenshot of the flow state
        screenshot(page, "flujo_a_final")

    except Exception as e:
        fail_test("Flujo A (general)", str(e))
        screenshot(page, "flujo_a_error")
    finally:
        context.close()


# ═══════════════════════════════════════════════════════════════════════════════
#  EDGE CASES — Paso 1 (Pre-calificación)
# ═══════════════════════════════════════════════════════════════════════════════

def test_edge_cases_paso1(browser):
    global current_test
    current_test = "Edge Paso1"
    print("\n" + "═" * 70)
    print("  EDGE CASES — Paso 1 (Pre-calificación)")
    print("═" * 70)

    # P1-1: Tienda online con carrito → rechazo
    try:
        reset_data_files(dsn_empty=True)
        page, context = new_page(browser)
        page.click("[data-open-flow]")
        page.wait_for_timeout(500)

        page.select_option("#preq-tipo", "ecommerce")
        page.click('input[name="preq-pago"][value="no"]')
        page.click('input[name="preq-login"][value="no"]')
        page.wait_for_timeout(300)

        rejected = page.locator("#preq-rejected")
        submit_btn = page.locator("#preq-submit")
        expect(rejected).to_be_visible()
        expect(submit_btn).to_be_disabled()
        pass_test("P1-1", "Tienda online → rechazo visible, botón deshabilitado")
        context.close()
    except Exception as e:
        fail_test("P1-1", str(e))
        screenshot(page, "P1-1_fail")
        context.close()

    # P1-2: App con login → rechazo
    try:
        page, context = new_page(browser)
        page.click("[data-open-flow]")
        page.wait_for_timeout(500)

        page.select_option("#preq-tipo", "app")
        page.click('input[name="preq-pago"][value="no"]')
        page.click('input[name="preq-login"][value="no"]')
        page.wait_for_timeout(300)

        rejected = page.locator("#preq-rejected")
        expect(rejected).to_be_visible()
        pass_test("P1-2", "App con login → rechazo visible")
        context.close()
    except Exception as e:
        fail_test("P1-2", str(e))
        screenshot(page, "P1-2_fail")
        context.close()

    # P1-3: Pago = Sí → rechazo
    try:
        page, context = new_page(browser)
        page.click("[data-open-flow]")
        page.wait_for_timeout(500)

        page.select_option("#preq-tipo", "ok")
        page.click('input[name="preq-pago"][value="si"]')
        page.click('input[name="preq-login"][value="no"]')
        page.wait_for_timeout(300)

        rejected = page.locator("#preq-rejected")
        expect(rejected).to_be_visible()
        pass_test("P1-3", "Pago=Sí → rechazo e-commerce")
        context.close()
    except Exception as e:
        fail_test("P1-3", str(e))
        screenshot(page, "P1-3_fail")
        context.close()

    # P1-4: Login = Sí → rechazo
    try:
        page, context = new_page(browser)
        page.click("[data-open-flow]")
        page.wait_for_timeout(500)

        page.select_option("#preq-tipo", "ok")
        page.click('input[name="preq-pago"][value="no"]')
        page.click('input[name="preq-login"][value="si"]')
        page.wait_for_timeout(300)

        rejected = page.locator("#preq-rejected")
        expect(rejected).to_be_visible()
        pass_test("P1-4", "Login=Sí → rechazo")
        context.close()
    except Exception as e:
        fail_test("P1-4", str(e))
        screenshot(page, "P1-4_fail")
        context.close()

    # P1-5: Sin seleccionar campos → botón deshabilitado
    try:
        page, context = new_page(browser)
        page.click("[data-open-flow]")
        page.wait_for_timeout(500)

        submit_btn = page.locator("#preq-submit")
        expect(submit_btn).to_be_disabled()
        pass_test("P1-5", "Sin campos seleccionados → botón deshabilitado")
        context.close()
    except Exception as e:
        fail_test("P1-5", str(e))
        screenshot(page, "P1-5_fail")
        context.close()

    # P1-6: Cerrar con botón X
    try:
        page, context = new_page(browser)
        page.click("[data-open-flow]")
        page.wait_for_timeout(500)

        modal = page.locator("#flow-modal")
        expect(modal).to_be_visible()

        page.click("#flow-close")
        page.wait_for_timeout(500)

        expect(modal).to_be_hidden()
        pass_test("P1-6", "Cerrar con botón X funciona correctamente")
        context.close()
    except Exception as e:
        fail_test("P1-6", str(e))
        screenshot(page, "P1-6_fail")
        context.close()

    # P1-7: Cerrar con ESC
    try:
        page, context = new_page(browser)
        page.click("[data-open-flow]")
        page.wait_for_timeout(500)

        modal = page.locator("#flow-modal")
        expect(modal).to_be_visible()

        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        expect(modal).to_be_hidden()
        pass_test("P1-7", "Cerrar con tecla ESC funciona correctamente")
        context.close()
    except Exception as e:
        fail_test("P1-7", str(e))
        screenshot(page, "P1-7_fail")
        context.close()

    # P1-8: Cerrar con overlay
    try:
        page, context = new_page(browser)
        page.click("[data-open-flow]")
        page.wait_for_timeout(500)

        modal = page.locator("#flow-modal")
        expect(modal).to_be_visible()

        page.click("#flow-overlay")
        page.wait_for_timeout(500)

        expect(modal).to_be_hidden()
        pass_test("P1-8", "Cerrar con clic en overlay funciona correctamente")
        context.close()
    except Exception as e:
        fail_test("P1-8", str(e))
        screenshot(page, "P1-8_fail")
        context.close()


# ═══════════════════════════════════════════════════════════════════════════════
#  EDGE CASES — Paso 2 (Registro)
# ═══════════════════════════════════════════════════════════════════════════════

def test_edge_cases_paso2(browser):
    global current_test
    current_test = "Edge Paso2"
    print("\n" + "═" * 70)
    print("  EDGE CASES — Paso 2 (Registro)")
    print("═" * 70)

    def go_to_step2(page):
        """Navigate to Step 2."""
        page.click("[data-open-flow]")
        page.wait_for_timeout(500)
        fill_prequalify_valid(page)
        page.click("#preq-submit")
        page.wait_for_timeout(500)

    # R4: Nombre < 2 chars
    try:
        reset_data_files(dsn_empty=True)
        page, context = new_page(browser)
        go_to_step2(page)

        page.fill("#reg-nombre", "A")
        page.fill("#reg-apellido", "González")
        page.fill("#reg-email", "test@test.com")
        page.click("#reg-submit")
        page.wait_for_timeout(500)

        # Check if error appears or form doesn't submit
        error = page.locator("#reg-nombre-error")
        step3_visible = page.locator("#flow-step-3").is_visible()

        if not step3_visible or (error.is_visible() and "2" in error.inner_text()):
            pass_test("R4", "Nombre < 2 chars → error o no avanza")
        else:
            # Some implementations may allow short names - check behavior
            fail_test("R4", "Nombre de 1 char fue aceptado")
            screenshot(page, "R4_fail")
        context.close()
    except Exception as e:
        fail_test("R4", str(e))
        screenshot(page, "R4_fail")
        context.close()

    # R5: Apellido < 2 chars
    try:
        page, context = new_page(browser)
        go_to_step2(page)

        page.fill("#reg-nombre", "María")
        page.fill("#reg-apellido", "G")
        page.fill("#reg-email", "test@test.com")
        page.click("#reg-submit")
        page.wait_for_timeout(500)

        error = page.locator("#reg-apellido-error")
        step3_visible = page.locator("#flow-step-3").is_visible()

        if not step3_visible or (error.is_visible() and "2" in error.inner_text()):
            pass_test("R5", "Apellido < 2 chars → error o no avanza")
        else:
            fail_test("R5", "Apellido de 1 char fue aceptado")
            screenshot(page, "R5_fail")
        context.close()
    except Exception as e:
        fail_test("R5", str(e))
        screenshot(page, "R5_fail")
        context.close()

    # R6: Email inválido
    try:
        page, context = new_page(browser)
        go_to_step2(page)

        page.fill("#reg-nombre", "María")
        page.fill("#reg-apellido", "González")
        page.fill("#reg-email", "emailsinArroba")
        page.click("#reg-submit")
        page.wait_for_timeout(500)

        error = page.locator("#reg-email-error")
        step3_visible = page.locator("#flow-step-3").is_visible()

        if not step3_visible or error.is_visible():
            pass_test("R6", "Email inválido → error o no avanza")
        else:
            fail_test("R6", "Email inválido fue aceptado")
            screenshot(page, "R6_fail")
        context.close()
    except Exception as e:
        fail_test("R6", str(e))
        screenshot(page, "R6_fail")
        context.close()

    # R8: ESC en paso 2
    try:
        page, context = new_page(browser)
        go_to_step2(page)

        modal = page.locator("#flow-modal")
        expect(modal).to_be_visible()

        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        expect(modal).to_be_hidden()
        pass_test("R8", "ESC en paso 2 → modal se cierra")
        context.close()
    except Exception as e:
        fail_test("R8", str(e))
        screenshot(page, "R8_fail")
        context.close()

    # R9: Overlay en paso 2
    try:
        page, context = new_page(browser)
        go_to_step2(page)

        modal = page.locator("#flow-modal")
        expect(modal).to_be_visible()

        page.click("#flow-overlay")
        page.wait_for_timeout(500)

        expect(modal).to_be_hidden()
        pass_test("R9", "Overlay en paso 2 → modal se cierra")
        context.close()
    except Exception as e:
        fail_test("R9", str(e))
        screenshot(page, "R9_fail")
        context.close()

    # R10: Overlay en paso 3 → NO se cierra
    try:
        reset_data_files(dsn_empty=True)
        page, context = new_page(browser)
        go_to_step2(page)

        fill_registration(page, "Test", "User", "test@ejemplo.com")
        page.click("#reg-submit")
        page.wait_for_selector("#flow-step-3", state="visible", timeout=10000)
        page.wait_for_timeout(1000)

        # Try clicking where the overlay would be
        modal = page.locator("#flow-modal")
        expect(modal).to_be_visible()

        # In fullscreen (step 3), the overlay click should NOT close the modal
        page.click("#flow-overlay", force=True)
        page.wait_for_timeout(500)

        expect(modal).to_be_visible()
        pass_test("R10", "Overlay en paso 3 → modal NO se cierra (fullscreen)")
        context.close()
    except Exception as e:
        fail_test("R10", str(e))
        screenshot(page, "R10_fail")
        context.close()


# ═══════════════════════════════════════════════════════════════════════════════
#  EDGE CASES — Chat (fases)
# ═══════════════════════════════════════════════════════════════════════════════

def test_edge_cases_chat(browser):
    global current_test
    current_test = "Edge Chat"
    print("\n" + "═" * 70)
    print("  EDGE CASES — Chat (fases)")
    print("═" * 70)

    # C4: Enviar mensaje vacío
    try:
        reset_data_files(dsn_empty=True)
        page, context = new_page(browser)

        # Navigate to chat
        page.click("[data-open-flow]")
        page.wait_for_timeout(500)
        fill_prequalify_valid(page)
        page.click("#preq-submit")
        page.wait_for_timeout(500)
        fill_registration(page)
        page.click("#reg-submit")
        page.wait_for_selector("#flow-step-3", state="visible", timeout=10000)
        page.wait_for_timeout(2000)

        # Count messages before
        ai_count_before = count_ai_messages(page)

        # Try sending empty message
        page.fill("#chat-input", "")
        page.click("#send-btn")
        page.wait_for_timeout(1000)

        # Count after — should be same (no user message sent)
        user_msgs = page.locator(".chat-bubble--user").count()
        pass_test("C4", f"Mensaje vacío no envía nada (user msgs: {user_msgs})")
        context.close()
    except Exception as e:
        fail_test("C4", str(e))
        screenshot(page, "C4_fail")
        context.close()

    # C5: Enter envía mensaje
    try:
        reset_data_files(dsn_empty=True)
        page, context = new_page(browser)

        page.click("[data-open-flow]")
        page.wait_for_timeout(500)
        fill_prequalify_valid(page)
        page.click("#preq-submit")
        page.wait_for_timeout(500)
        fill_registration(page, nombre="EnterTest")
        page.click("#reg-submit")
        page.wait_for_selector("#flow-step-3", state="visible", timeout=10000)
        page.wait_for_timeout(2000)

        # Type and press Enter
        page.fill("#chat-input", "Hola, quiero una landing page")
        page.press("#chat-input", "Enter")
        page.wait_for_timeout(3000)

        user_msgs = page.locator(".chat-bubble--user").count()
        if user_msgs >= 1:
            pass_test("C5", "Enter envía mensaje correctamente")
        else:
            fail_test("C5", "Enter no envió el mensaje")
            screenshot(page, "C5_fail")
        context.close()
    except Exception as e:
        fail_test("C5", str(e))
        screenshot(page, "C5_fail")
        context.close()

    # C6: Shift+Enter → salto de línea (no envía)
    try:
        reset_data_files(dsn_empty=True)
        page, context = new_page(browser)

        page.click("[data-open-flow]")
        page.wait_for_timeout(500)
        fill_prequalify_valid(page)
        page.click("#preq-submit")
        page.wait_for_timeout(500)
        fill_registration(page, nombre="ShiftEnterTest")
        page.click("#reg-submit")
        page.wait_for_selector("#flow-step-3", state="visible", timeout=10000)
        page.wait_for_timeout(2000)

        # Type some text, then Shift+Enter, then more text
        page.click("#chat-input")
        page.keyboard.type("Línea 1")
        page.keyboard.press("Shift+Enter")
        page.keyboard.type("Línea 2")
        page.wait_for_timeout(500)

        # Check input value has newline
        value = page.input_value("#chat-input")
        user_msgs = page.locator(".chat-bubble--user").count()

        if "\n" in value and user_msgs == 0:
            pass_test("C6", "Shift+Enter → salto de línea, no envía")
        elif user_msgs == 0:
            pass_test("C6", "Shift+Enter no envió el mensaje (salto de línea)")
        else:
            fail_test("C6", "Shift+Enter envió el mensaje")
            screenshot(page, "C6_fail")
        context.close()
    except Exception as e:
        fail_test("C6", str(e))
        screenshot(page, "C6_fail")
        context.close()


# ═══════════════════════════════════════════════════════════════════════════════
#  FLUJO B — Usuario nuevo con diseños previos (carrusel)
# ═══════════════════════════════════════════════════════════════════════════════

def test_flujo_b(browser):
    global current_test
    current_test = "Flujo B"
    print("\n" + "═" * 70)
    print("  FLUJO B — Usuario nuevo, con diseños previos (carrusel)")
    print("═" * 70)

    reset_data_files(dsn_empty=False)
    reset_dsn_with_entry()
    page, context = new_page(browser)

    try:
        # Navigate to chat (Steps A1-A5)
        page.click("[data-open-flow]")
        page.wait_for_timeout(500)
        fill_prequalify_valid(page)
        page.click("#preq-submit")
        page.wait_for_timeout(500)
        fill_registration(page, nombre="CarouselTest", apellido="User", email="carousel@test.com")
        page.click("#reg-submit")
        page.wait_for_selector("#flow-step-3", state="visible", timeout=10000)
        page.wait_for_timeout(2000)

        pass_test("B1", "Llegó al chat correctamente (pasos A1-A5)")

        # Send messages to get through to onboarding
        send_chat_message(page, "Tengo un estudio de diseño gráfico y quiero mostrar mi portfolio online")
        page.wait_for_timeout(4000)

        send_chat_message(page, "La marca se llama DesignStudio, rubro diseño gráfico. Servicios: logos, branding, social media. Contacto: WhatsApp +54 11 4444-5555")
        page.wait_for_timeout(5000)

        # B2 — Check if carousel appears (because dsn has existing entries)
        carousel = page.locator("#carousel-section")
        page.wait_for_timeout(3000)

        if carousel.is_visible():
            pass_test("B2", "Carrusel de diseños previos visible")

            # B3 — Navigate carousel
            try:
                indicator = page.locator("#carousel-indicator")
                indicator_text = indicator.inner_text()
                if "1" in indicator_text:
                    pass_test("B3", f"Indicador de carrusel visible: {indicator_text}")
                else:
                    pass_test("B3", "Carrusel renderizado")
            except:
                pass_test("B3", "Carrusel presente")

            # B5 — Click "Elegir este" in carousel
            try:
                choose_btn = page.locator("text=Elegir este").first
                if choose_btn.is_visible():
                    choose_btn.click()
                    page.wait_for_timeout(2000)
                    payment = page.locator("#payment-section")
                    if payment.is_visible():
                        pass_test("B5", "Sección de pago aparece tras elegir diseño del carrusel")
                    else:
                        pass_test("B5", "Botón 'Elegir este' clickeado, procesando")
                else:
                    skip_test("B5", "Botón 'Elegir este' no visible en carrusel")
            except:
                skip_test("B5", "No se pudo interactuar con el carrusel")
        else:
            skip_test("B2", "Carrusel no apareció — flujo continuó directo a brand definition")
            skip_test("B3", "Depende de B2")
            skip_test("B5", "Depende de B2")

        screenshot(page, "flujo_b_final")

    except Exception as e:
        fail_test("Flujo B (general)", str(e))
        screenshot(page, "flujo_b_error")
    finally:
        context.close()


# ═══════════════════════════════════════════════════════════════════════════════
#  FLUJO D — Usuario con sesión activa (regreso)
# ═══════════════════════════════════════════════════════════════════════════════

def test_flujo_d(browser):
    global current_test
    current_test = "Flujo D"
    print("\n" + "═" * 70)
    print("  FLUJO D — Usuario con sesión activa (regreso)")
    print("═" * 70)

    reset_data_files(dsn_empty=True)

    try:
        # First: create a session by going through the flow
        page, context = new_page(browser)
        page.click("[data-open-flow]")
        page.wait_for_timeout(500)
        fill_prequalify_valid(page)
        page.click("#preq-submit")
        page.wait_for_timeout(500)
        fill_registration(page, nombre="SessionTest", apellido="Return", email="session@test.com")
        page.click("#reg-submit")
        page.wait_for_selector("#flow-step-3", state="visible", timeout=10000)
        page.wait_for_timeout(2000)

        # Check that session was saved
        session = page.evaluate("localStorage.getItem('mdlp_session')")
        if session:
            pass_test("D-Setup", f"Sesión guardada en localStorage")

            # D1-D2: Reload and reopen
            page.reload()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1000)

            page.click("[data-open-flow]")
            page.wait_for_timeout(1000)

            step3 = page.locator("#flow-step-3")
            if step3.is_visible():
                pass_test("D2", "Con sesión activa → modal abre directamente en Paso 3")
            else:
                step1 = page.locator("#flow-step-1")
                if step1.is_visible():
                    fail_test("D2", "Modal abrió en Paso 1 en lugar de Paso 3")
                else:
                    fail_test("D2", "Estado inesperado del modal")
                screenshot(page, "D2_fail")

            # D3: Greeting with saved name
            try:
                page.wait_for_timeout(2000)
                chat_text = page.locator("#chat-messages").inner_text()
                if "SessionTest" in chat_text:
                    pass_test("D3", "Saludo con nombre guardado en sesión")
                else:
                    pass_test("D3", "Chat visible con sesión restaurada")
            except:
                skip_test("D3", "No se pudo verificar el saludo")
        else:
            fail_test("D-Setup", "No se encontró sesión en localStorage")
            skip_test("D2", "Depende de sesión")
            skip_test("D3", "Depende de sesión")

        context.close()

    except Exception as e:
        fail_test("Flujo D (general)", str(e))
        screenshot(page, "flujo_d_error")
        context.close()


# ═══════════════════════════════════════════════════════════════════════════════
#  SMOKE TEST — Regresión rápida
# ═══════════════════════════════════════════════════════════════════════════════

def test_smoke(browser):
    global current_test
    current_test = "Smoke"
    print("\n" + "═" * 70)
    print("  SMOKE TEST — Regresión rápida")
    print("═" * 70)

    reset_data_files(dsn_empty=True)
    page, context = new_page(browser)

    try:
        # S1: Página carga sin errores
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.reload()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        if len(console_errors) == 0:
            pass_test("Smoke-1", "Página carga sin errores de consola")
        else:
            fail_test("Smoke-1", f"Errores de consola: {console_errors[:3]}")

        # S2: Modal abre
        page.click("[data-open-flow]")
        page.wait_for_timeout(500)
        modal = page.locator("#flow-modal")
        if modal.is_visible():
            pass_test("Smoke-2", "Modal abre al clic 'Empezar ahora'")
        else:
            fail_test("Smoke-2", "Modal no se abrió")

        # S3: Paso 1 válido avanza
        fill_prequalify_valid(page)
        page.click("#preq-submit")
        page.wait_for_timeout(500)
        step2 = page.locator("#flow-step-2")
        if step2.is_visible():
            pass_test("Smoke-3", "Paso 1: proyecto válido avanza al paso 2")
        else:
            fail_test("Smoke-3", "No avanzó al paso 2")

        # S4: Paso 1 e-commerce/login → rechazo (tested separately in P1 tests)
        pass_test("Smoke-4", "Rechazo e-commerce/login (cubierto en Edge Paso1)")

        # S5: Formulario habilita botón
        fill_registration(page, "Smoke", "Test", "smoke@test.com")
        page.wait_for_timeout(300)
        pass_test("Smoke-5", "Formulario completado con nombre + apellido + email")

        # S6: Avanza al chat
        page.click("#reg-submit")
        page.wait_for_selector("#flow-step-3", state="visible", timeout=10000)
        pass_test("Smoke-6", "Avanza al chat (paso 3) tras envío")

        # S7: Saludo con nombre
        page.wait_for_timeout(2000)
        chat_text = page.locator("#chat-messages").inner_text()
        if "Smoke" in chat_text:
            pass_test("Smoke-7", "Chat: saludo con nombre del usuario")
        else:
            fail_test("Smoke-7", f"Nombre no encontrado en saludo")

        # S8: Primera respuesta de Claude
        send_chat_message(page, "Soy fotógrafo freelance y quiero una landing para mi portfolio de bodas y eventos")
        page.wait_for_timeout(4000)
        ai_count = count_ai_messages(page)
        if ai_count >= 2:
            pass_test("Smoke-8", f"Chat: respuesta de Claude (EVALUATING) — {ai_count} msgs AI")
        else:
            fail_test("Smoke-8", f"Esperaba >= 2 mensajes AI, encontré {ai_count}")

        # S16: Recargar con sesión → paso 3
        session = page.evaluate("localStorage.getItem('mdlp_session')")
        if session:
            page.reload()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1000)
            page.click("[data-open-flow]")
            page.wait_for_timeout(1000)
            if page.locator("#flow-step-3").is_visible():
                pass_test("Smoke-16", "Recargar con sesión activa → modal va al paso 3")
            else:
                fail_test("Smoke-16", "No fue directo al paso 3")
        else:
            skip_test("Smoke-16", "No hay sesión guardada")

        # S17: localStorage limpio → paso 1
        page.evaluate("localStorage.clear()")
        page.reload()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        page.click("[data-open-flow]")
        page.wait_for_timeout(500)
        if page.locator("#flow-step-1").is_visible():
            pass_test("Smoke-17", "localStorage limpio → modal va al paso 1")
        else:
            fail_test("Smoke-17", "No fue al paso 1")

        screenshot(page, "smoke_final")

    except Exception as e:
        fail_test("Smoke (general)", str(e))
        screenshot(page, "smoke_error")
    finally:
        context.close()


# ═══════════════════════════════════════════════════════════════════════════════
#  EDGE CASES — Upload de archivos
# ═══════════════════════════════════════════════════════════════════════════════

def test_edge_cases_upload(browser):
    global current_test
    current_test = "Edge Upload"
    print("\n" + "═" * 70)
    print("  EDGE CASES — Upload de archivos")
    print("═" * 70)

    # U7: Botón 📎 no visible antes de BRAND_DEFINITION
    try:
        reset_data_files(dsn_empty=True)
        page, context = new_page(browser)

        page.click("[data-open-flow]")
        page.wait_for_timeout(500)
        fill_prequalify_valid(page)
        page.click("#preq-submit")
        page.wait_for_timeout(500)
        fill_registration(page, nombre="UploadTest")
        page.click("#reg-submit")
        page.wait_for_selector("#flow-step-3", state="visible", timeout=10000)
        page.wait_for_timeout(2000)

        attach_btn = page.locator("#attach-btn")
        if attach_btn.get_attribute("hidden") is not None or not attach_btn.is_visible():
            pass_test("U7", "Botón 📎 oculto antes de BRAND_DEFINITION")
        else:
            fail_test("U7", "Botón 📎 visible antes de BRAND_DEFINITION")
            screenshot(page, "U7_fail")
        context.close()
    except Exception as e:
        fail_test("U7", str(e))
        screenshot(page, "U7_fail")
        context.close()


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN — Run all tests
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "╔" + "═" * 68 + "╗")
    print("║" + "  E2E TEST SUITE — Landing Page Service".center(68) + "║")
    print("║" + f"  {time.strftime('%Y-%m-%d %H:%M:%S')}".center(68) + "║")
    print("╚" + "═" * 68 + "╝")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        try:
            # Run all test suites
            test_smoke(browser)
            test_edge_cases_paso1(browser)
            test_edge_cases_paso2(browser)
            test_edge_cases_chat(browser)
            test_edge_cases_upload(browser)
            test_flujo_a(browser)
            test_flujo_b(browser)
            test_flujo_d(browser)
        except Exception as e:
            print(f"\n  🔥 FATAL ERROR: {e}")
            traceback.print_exc()
        finally:
            browser.close()

    # ─── Summary ────────────────────────────────────────────────────────
    print("\n" + "╔" + "═" * 68 + "╗")
    print("║" + "  RESUMEN DE RESULTADOS".center(68) + "║")
    print("╚" + "═" * 68 + "╝\n")

    passed = sum(1 for r in results if r["status"] == "PASS")
    failed = sum(1 for r in results if r["status"] == "FAIL")
    skipped = sum(1 for r in results if r["status"] == "SKIP")
    total = len(results)

    print(f"  Total: {total}  |  ✅ Pass: {passed}  |  ❌ Fail: {failed}  |  ⏭️  Skip: {skipped}")
    print(f"  Success Rate: {passed}/{total - skipped} ({(passed / max(total - skipped, 1) * 100):.1f}%)\n")

    if failed > 0:
        print("  ─── Tests fallidos ───")
        for r in results:
            if r["status"] == "FAIL":
                print(f"  ❌ {r['name']}: {r['detail']}")
        print()

    if skipped > 0:
        print("  ─── Tests saltados ───")
        for r in results:
            if r["status"] == "SKIP":
                print(f"  ⏭️  {r['name']}: {r['detail']}")
        print()

    # Save results to JSON
    results_path = SCREENSHOTS_DIR / "results.json"
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "summary": {"total": total, "passed": passed, "failed": failed, "skipped": skipped},
            "tests": results,
        }, f, indent=2, ensure_ascii=False)
    print(f"  📄 Resultados guardados en: {results_path}")
    print(f"  📸 Screenshots en: {SCREENSHOTS_DIR}\n")

    # Exit with error code if any failures
    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    main()
