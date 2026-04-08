---
name: lead-qualifier-engine
description: Implement and maintain the 5-step booking qualifier form so that every Agendar reunion CTA opens it and steps 3 to 5 adapt to the selected service, especially Assessment, Modernization, and Fractional.
---

# Lead Qualifier Engine

Use this skill when editing the booking modal and CTA flow.

## Fixed Flow

1. Personal data
   - Nombre
   - Correo
   - Pais
   - Empresa opcional
2. Q1 service selection
3. Adaptive qualification
4. Adaptive qualification
5. Adaptive qualification and submit

## Conditional Logic

- If `Assessment`:
  - Ask data volume
  - Ask current cloud stack
- If `Modernization`:
  - Ask source platform
  - Ask desired timeline
- If `Fractional`:
  - Ask team size
  - Ask operating pain points

## Enforcement

- Every `Agendar reunion` CTA must trigger this modal.
- Keep the experience B2B and concise.
- Avoid dead-end steps: always adapt the copy and controls to the selected service.
