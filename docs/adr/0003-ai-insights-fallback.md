# ADR-0003: Rule-based insights first, LLM only behind an interface

- Status: accepted
- Date: 2026-11-10

## Context

Operators want to “ask the data” in natural language, and later they will want suggested actions
(restaff a shift, investigate a sales dip). Sending raw tickets and employee rows to a third-party
model is the wrong default: it is expensive, hard to audit, and unnecessary for the questions
people actually ask first.

## Decision

- KPI computation and anomaly detection are deterministic TypeScript, unit-tested, and the source
  of truth for every number shown in the UI.
- “Ask your data” is an `AskAssistant` port. The default implementation answers from those KPIs
  with a small rule engine so the live demo and CI never need a network key.
- An optional LLM implementation may be plugged in via environment variables. It receives the
  aggregated snapshot only, its output is treated as untrusted text, and any failure falls back to
  the rules.
- The assistant never writes to the store and never auto-closes an anomaly.

## Consequences

- The demo works fully offline.
- When a team later enables a model, evaluation can compare its answers against the rule engine
  and the same KPI fixture.
- Automation built on top (staffing nudges, prep lists) should follow the same pattern: suggest,
  never silently mutate operational records.
