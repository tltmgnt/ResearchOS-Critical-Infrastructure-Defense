# ResearchOS-CID version 1 model contract

## Purpose

This is a deterministic, assumption-driven educational model for defensive resilience research. It is **not** an operational tool, a physical infrastructure model, a threat prediction engine, an AI analysis system, or an attack planning tool. All bundled examples are fictional.

## Inputs

Each asset has a sector, criticality weight (1–5), recoveryDays (1–30), and zero or more directed dependencies with influence weights (0–1). The dependency graph must be **acyclic**. An event affects one asset with a start day (1–90), duration (1–60 days), and severity (0–100%). A scenario defines the simulation horizon (1–90 days). Events may overlap and may extend past the horizon. A safeguard has a declared efficacy (0–90%) and user-defined investment amount. Enabling a safeguard applies it only to its own asset. No probability is inferred.

## Calculation order on each day

1. Calculate each event's direct impairment for its target: full assumed severity on affected days, followed by a linear decay over the target's recoveryDays. It is zero before the event or after recovery.
2. Combine simultaneous events on one asset multiplicatively as survival fractions, not as physical outage estimates.
3. Calculate assets in dependency-first topological order. Dependency survival is the product of (1 - influence × upstream loss fraction) for each declared dependency.
4. Combine direct and dependency losses as 1 - (1 - directLoss) × (1 - dependencyLoss).
5. For enabled controls, multiply this modeled local loss by (1 - declaredEfficacy). Report daily service as 100 × (1 - modeledLoss).
6. Compute each day's system service index as the **criticality-weighted average** service across all assets. Sector indices use the same weights within each sector.

Summaries: average daily service index, minimum daily service index, service deficit area (sum of 100 - dailyIndex, in percentage-point-days), and assumed control investment. Recovery day is the first day **after the last event ends** when the system index reaches at least 99.5%, or N/A within the modeled horizon.

## Interpretation limitations

- No live telemetry, vulnerability scanner, cyber exploitation guidance, classified inputs, or integrations with control systems.
- Influence weights are **not** real-world failure probabilities or calibrated transfer functions. Interdependencies and recovery can be nonlinear in reality.
- The model does not represent redundancy, capacity constraints, system physics, restoration resource allocation, geographic topology, cascading failures with feedback loops, or stochastic uncertainty.
- Safeguard efficacy is a declared illustration, not validated effectiveness or financial ROI. Money is user-defined cost units; no economic benefit calculation is made.
- The risk register is subjective likelihood × impact (1–25), with low 1–7, moderate 8–15, high 16–25. A score is not an event probability.
- Notes and references are user-supplied, unverified and not signed audit records.
- Data export contains text that may be sensitive; do not load real operational data without authorization and an independent security review.

## Validation plan for future research

Calibrate with non-sensitive, authorized historical records; document uncertainty; compare against independent baseline methods; have independent domain reviewers check assumptions and restore sequences; extend to distributions and Monte Carlo uncertainty with documented seeds; test usability, accessibility, and data governance. Do not treat this prototype as evaluated in field conditions.
