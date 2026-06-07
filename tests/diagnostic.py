"""Diagnostic script to trace exactly why Step 2 -> Step 3 transition fails."""
import json
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3000/landing_page/"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Capture ALL console output
    console_logs = []
    page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: console_logs.append(f"[PAGE_ERROR] {err}"))

    # Load page
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_load_state("networkidle")

    print("=== After page load ===")
    for log in console_logs:
        print(f"  {log}")
    console_logs.clear()

    # Check if flowModal exists
    has_modal = page.evaluate("typeof window.flowModal")
    print(f"\nwindow.flowModal type: {has_modal}")

    has_chat_ready = page.evaluate("typeof window._chatSessionReady")
    print(f"window._chatSessionReady type: {has_chat_ready}")

    # Check if initRegistrationForm was called by checking if the click handler exists
    # We can test this by checking if reg-submit has event listeners
    reg_submit_disabled = page.evaluate("document.getElementById('reg-submit')?.disabled")
    print(f"reg-submit disabled: {reg_submit_disabled}")

    # Inject diagnostic logging into validator flow
    page.evaluate("""
        // Wrap the reg-submit click to trace
        const btn = document.getElementById('reg-submit');
        if (btn) {
            const origListeners = btn.onclick;
            console.log('[DIAG] reg-submit button found, disabled=' + btn.disabled);
            console.log('[DIAG] reg-submit event listeners count (approx): checking...');
            
            // Check if addEventListener was called by trying to get registered listeners
            // We can't directly, but we can add our own listener to see if the original fires
            btn.addEventListener('click', () => {
                console.log('[DIAG] reg-submit click handler fired (our diagnostic listener)');
            });
        } else {
            console.log('[DIAG] reg-submit button NOT FOUND');
        }
    """)

    # Open modal
    page.click("[data-open-flow]")
    page.wait_for_timeout(500)

    # Fill Step 1
    page.select_option("#preq-tipo", "ok")
    page.click('input[name="preq-pago"][value="no"]')
    page.click('input[name="preq-login"][value="no"]')

    preq_disabled = page.evaluate("document.getElementById('preq-submit')?.disabled")
    print(f"\npreq-submit disabled before click: {preq_disabled}")

    page.click("#preq-submit")
    page.wait_for_timeout(500)

    # Check step 2 visible
    step2_visible = page.evaluate("!document.getElementById('flow-step-2')?.hidden")
    print(f"Step 2 visible: {step2_visible}")

    # Fill Step 2
    page.fill("#reg-nombre", "TestDiag")
    page.fill("#reg-apellido", "Usuario")
    page.fill("#reg-email", "diag@test.com")
    page.wait_for_timeout(300)

    # Check button state after fill
    reg_submit_disabled_after = page.evaluate("document.getElementById('reg-submit')?.disabled")
    reg_submit_text = page.evaluate("document.getElementById('reg-submit')?.textContent?.trim()")
    print(f"\nreg-submit disabled after fill: {reg_submit_disabled_after}")
    print(f"reg-submit text: {reg_submit_text}")

    print("\n=== Console logs before click ===")
    for log in console_logs:
        print(f"  {log}")
    console_logs.clear()

    # Click the button
    print("\n=== Clicking reg-submit ===")
    page.click("#reg-submit")

    # Wait and check
    page.wait_for_timeout(3000)

    print("\n=== Console logs after click (3s) ===")
    for log in console_logs:
        print(f"  {log}")

    # Check state
    step3_visible = page.evaluate("!document.getElementById('flow-step-3')?.hidden")
    step2_still = page.evaluate("!document.getElementById('flow-step-2')?.hidden")
    btn_text_after = page.evaluate("document.getElementById('reg-submit')?.textContent?.trim()")
    btn_disabled_after = page.evaluate("document.getElementById('reg-submit')?.disabled")
    chat_ready = page.evaluate("window._chatSessionReady")

    print(f"\nStep 3 visible: {step3_visible}")
    print(f"Step 2 still visible: {step2_still}")
    print(f"reg-submit text after click: {btn_text_after}")
    print(f"reg-submit disabled after click: {btn_disabled_after}")
    print(f"_chatSessionReady: {chat_ready}")

    # Check localStorage
    session = page.evaluate("localStorage.getItem('mdlp_session')")
    print(f"Session in localStorage: {session}")

    # Take screenshot
    page.screenshot(path="tests/screenshots/diagnostic.png", full_page=True)
    print("\nScreenshot saved to tests/screenshots/diagnostic.png")

    browser.close()
