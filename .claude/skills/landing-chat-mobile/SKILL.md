---
name: landing-chat-mobile
description: Reference for the mobile/keyboard layout of the landing-page chat widget (flow modal step 3) in this project. Use before touching mobile viewport, keyboard, scroll, or full-screen chat behavior — and update this file in the same change if any of it shifts.
---

# Landing Chat — Mobile & Keyboard Layout

Local, project-only reference. Covers exclusively the mobile viewport/keyboard
behavior of the chat inside the flow modal (`#flow-modal` → step 3 → `#chat-section`)
in `landing_page/`. Not about chat logic/prompts — only layout and viewport.

## Why this exists

On mobile, opening the on-screen keyboard while the chat input is focused must
behave like WhatsApp: header fixed, messages scrollable, input fixed and visible,
**last message always in view**. iOS Safari does not shrink the layout viewport
(`100vh`) when the keyboard opens — it just visually covers part of a fixed-height
container. Without the mechanism below, the last assistant message ends up hidden
above the keyboard while the input box is empty-looking below it.

## Current mechanism (4 pieces, must move together)

1. **`landing_page/index.html`** — viewport meta has
   `interactive-widget=resizes-content`. Lets Chromium/Android actually resize the
   layout viewport with the keyboard instead of just covering it.

2. **`landing_page/styles.css`** — `.flow-container--full` (base rule + the
   `@media (max-width: 640px)` override) uses
   `height: var(--app-height, 100vh)` / `max-height: var(--app-height, 100vh)`,
   never a hardcoded `100vh`. `--app-height` is set by JS (#3) to the real visible
   height; the `100vh` fallback only applies before JS runs or if `visualViewport`
   is unsupported.

3. **`landing_page/modal.js`** — `_initViewportTracking()` (called from `init()`):
   - Reads `window.visualViewport.height` (fallback `window.innerHeight`) and
     writes it to `--app-height` on `document.documentElement`.
   - Listens on `visualViewport.resize` (fallback `window.resize`).
   - On every resize, if `currentStep === 3` and `document.activeElement.id ===
     'chat-input'`, re-pins `#chat-messages.scrollTop` to `scrollHeight` — this is
     what keeps the last message glued above the keyboard.

4. **`landing_page/chat.js`** — `setupEventListeners()` has a `focus` listener on
   `#chat-input` that re-pins `#chat-messages` scroll to bottom after a 350ms
   timeout. Safety net for browsers/timing where the resize event fires before the
   keyboard animation finishes (the viewport listener alone raced and lost in
   manual testing on some devices).

These four are one mechanism. A change to any one of them (e.g. renaming
`#chat-input`/`#chat-messages`, restructuring `.flow-container--full`, changing
how/when `currentStep` reaches `3`, or touching the viewport meta) breaks the
others silently — there is no test that fails loudly if you drop the JS half
while leaving the CSS var in place (it would just silently fall back to `100vh`
behavior on mobile).

## Maintenance rule

**Any change to mobile chat layout, viewport, keyboard handling, or scroll
behavior in the files above must also update this SKILL.md in the same change.**
Update the relevant section above; if the mechanism changes shape (not just file
names), rewrite "Current mechanism" rather than appending a second mechanism.

## How to verify a change

No permanent automated test covers this (a real OS keyboard isn't simulated by
Playwright). To check manually after editing:

1. `npm test` (162 unit) and `npx playwright test` (40 e2e) must stay green —
   they don't test the keyboard behavior but will catch breakage of the chat flow
   itself.
2. Reach step 3 of the flow (prequalify → register) on a mobile viewport, e.g.
   via Playwright with `viewport: { width: 390, height: 844 }`.
3. Focus `#chat-input`, then shrink the viewport height in place (e.g.
   `page.setViewportSize({ width: 390, height: 500 })`) to simulate the keyboard
   covering ~340px, without navigating away (this mirrors what a real keyboard
   open does to `visualViewport`).
4. Assert `#chat-messages.scrollTop + clientHeight >= scrollHeight - 2` (still
   pinned to bottom) and that `#chat-input` stays `toBeInViewport()`.

This is exactly the throwaway check used to validate the original fix (June 2026)
— recreate it ad hoc, don't leave it committed as a permanent spec.
