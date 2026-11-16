# ResearchOS TECT — Critical Infrastructure Defense

**An independent ResearchOS TECT workspace for defensive infrastructure resilience modeling.** Build an illustrative asset/dependency map, register qualitative risks, model synthetic disruptions, compare safeguard assumptions, record evidence and export reproducible results.

> **Status:** working, deterministic research prototype (v1.0). **Not** validated for operational defense, security decisions, control systems, incident response or critical-infrastructure planning. Independent project; no DARPA/DHS/CISA affiliation or endorsement. No AI inference is implemented despite the project's broader research roadmap.

## Features

- **Asset registry and dependency graph:** six sector types, service criticality, recovery assumptions and directed, acyclic influence links.
- **Scenario lab:** multiple scenarios, overlapping service impairments, configured duration and severity, 1–90-day service timelines, cross-service dependency effects.
- **Safeguard what-if analysis:** assumed effectiveness and cost per asset, side-by-side baseline vs enabled-control service indices.
- **Risk register:** likelihood × impact scoring, workflow status, and priority bands.
- **Evidence notebook:** free-text review notes with optional source references (not verified).
- **Reproducible exports:** portable study JSON, scenario results CSV, research memo Markdown, plus a CLI for deterministic evaluation.
- **Local-first privacy:** browser storage, no analytics or external APIs, no dependencies to install; Node built-in tests and GitHub Actions CI.

## Run locally

Requires Node.js 22+ and a modern browser. There are **no npm dependencies**.

```sh
npm start
```

Open **http://127.0.0.1:8000**. The app starts with a fictional six-service study. Create assets, test disruptions, adjust controls, record notes, and export. The project runs entirely in the browser; the Node server only serves static files.

```sh
npm test
npm run check
npm run build
ROOT=dist npm start
node cli.mjs examples/study.json outage
node cli.mjs examples/study.json outage results.csv
```

The CLI refuses to overwrite existing files. The build output is `dist/` and can be served from the web root of any static file server. Opening `index.html` directly using `file://` will not work with browser ES modules. If served under a URL subpath, update the absolute `/styles.css` and `/src/app.mjs` URLs to relative paths.

## Research workflow

1. Define fictional or authorized, non-sensitive services and directed dependency assumptions.
2. Register subjective risk items and their review status.
3. Construct one or more synthetic disruption events in a scenario.
4. Compare service continuity without and with hypothetical safeguards.
5. Record assumptions, confidence limitations and external source context in research notes.
6. Export the full study JSON, daily CSV and a Markdown methodology report.

## Import and data protections

Imports require version 1 study JSON and are rejected for invalid references, duplicate identifiers, graph cycles, out-of-range values and payloads over 1 MB. Current data is replaced after user confirmation. Browser storage is not encrypted or synchronized: **export backups regularly**. Never enter secrets, nonpublic infrastructure topology, sensitive operational data or classified information.

See [model specification](docs/MODEL.md) and [security boundaries](docs/SECURITY.md) before interpreting any result.

## Limitations and next phase

This is a **complete local research vertical slice**, not a production system. It lacks calibrated threat probabilities, measured dependency effects, live infrastructure feeds, authenticated teams, signed provenance, uncertainty distributions, real-world restoration operations, and independent model validation. AI-assisted analysis would require a separately designed, reviewed backend with appropriate data controls.

Suggested research directions: sensitivity analysis, bounded uncertainty ensembles, non-sensitive public datasets, baseline comparisons, peer review workflows and independent usability/accessibility testing. There is no claim of novel algorithms, government sponsorship, operational readiness or empirical effectiveness.

## Verification

`npm run check` runs syntax checks, unit tests, and a reproducible static build. GitHub Actions also checks CLI execution and uploads a static artifact. No hosting or public deployment is configured automatically.

## License

No license is granted by this README. Repository owner should choose and add a license before inviting external contributions.

## ResearchOS TECT

This repository is part of Troy Turner's independent ResearchOS TECT research effort, supporting reproducible scenario modeling, explicit assumptions, evidence-linked review and portable research outputs.

- Repository: https://github.com/tltmgnt/ResearchOS-Critical-Infrastructure-Defense
- Research portfolio: https://github.com/tltmgnt?tab=repositories

TECT is retained as the project identifier without an assumed expansion. Inclusion in the portfolio does not imply government affiliation, sponsorship or operational validation.
