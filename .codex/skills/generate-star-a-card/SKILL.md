---
name: generate-star-a-card
description: Create a new Bento Grid project card from raw notes using the STAR-A framework, automatically choose a technical icon such as Databricks, Snowflake, or SAP from the content, and output Tailwind HTML styled as frosted glass with rounded-[2.5rem] using the bento-card class and brand-hover accent.
---

# Generate STAR-A Card

Use this skill when adding a new project module to the Bento Grid from messy notes.

## Workflow

1. Convert the raw notes into STAR-A:
   - `Situation`
   - `Task`
   - `Action`
   - `Result`
   - `Aftermath`
2. Frame the business value through Martin's thesis:
   - "De petroleo a producto"
   - Prioritize profitability, operating leverage, decision velocity, or TCO reduction.
3. Auto-assign the icon:
   - `Databricks` when the notes mention lakehouse, medallion, notebooks, Delta, Spark.
   - `Snowflake` when the notes mention virtual warehouses, dbt, sharing, Snowpipe.
   - `SAP` when the notes mention ERP, OT, work orders, transactional integrity, master data.
   - Fall back to `Cloud` when no direct vendor signal exists.
4. Output only the Bento card HTML ready to paste into `index.html`.

## Output Rules

- Use the `bento-card` class.
- Keep `rounded-[2.5rem]`.
- Use Tailwind utility classes consistent with the landing.
- Add subtle frosted-glass treatment and a hover accent that resolves to `--brand`.
- Lead with the impact metric, then the architectural move.
- Keep copy concise and executive-friendly.

## Prompt

`Crea un nuevo item para el Bento Grid. Usa el framework STAR-A. Destaca el impacto en rentabilidad siguiendo la tesis de Martin: "De petroleo a producto". Aplica la clase bento-card con hover de acento --brand (#2563EB).`
