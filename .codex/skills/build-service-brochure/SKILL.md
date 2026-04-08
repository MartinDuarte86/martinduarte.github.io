---
name: build-service-brochure
description: Build a 3 to 6 page interactive service brochure that mirrors the landing page typography and colors, includes authority profile, portfolio structure, service deep dive, and direct contact, and prints identically to PDF with @media print.
---

# Build Service Brochure

Use this skill when creating or updating any brochure in `brochures/`.

## Required Structure

1. Page 1: Authority profile
   - 10+ years of experience
   - Banca, Oil & Gas, Retail
   - Master en IA (UdeSA)
   - Lic. en Big Data (UP)
2. Page 2: Portfolio structure
   - Show relationship between strategic and complementary services
3. Pages 3-5: Service deep dive
   - Definition
   - Oriented to
   - Pain points
   - Results
   - Methodology
   - Scope
   - Deliverables
4. Final page or footer contact:
   - `Martynduarte@gmail.com`
   - `1123797308`

## Design Rules

- Match the landing page fonts and palette.
- Use `@media print` so the PDF matches on-screen typography and colors.
- Minimum 3 pages, maximum 6.
- Prefer bold editorial layouts over generic report styling.
- Keep the contact details visible on the last page and footer.

## Source Handling

- If a Word source exists, extract the service definition and deliverables from it.
- If no Word source exists, infer from the current service card and brochure copy, and state that assumption in the final handoff.
