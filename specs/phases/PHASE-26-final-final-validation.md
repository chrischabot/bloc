# Phase 26 — Final-Final Pixel-Perfect & Parity Validation

## Goal

The absolute terminal acceptance gate. After Phases 24 (internal v3 API) and 25 (data sources) ship, re-run pixel-perfect, behavioural parity, performance, and observability validation across the **entire** product surface.

## Read first

- `docs/frontend/17-pixel-perfect-checklist.md`
- `docs/architecture/09-internal-v3-api.md#honest-scope`
- `docs/README.md#honest-scoping`
- `docs/prompts/PIXEL-PERFECT-REVIEW.md`

## Deliverables

1. **Public REST conformance**: `@notionhq/client` (latest `≥ 2.4.0`) drives every operation in the SDK-progressive matrix against our server. All tests green.
2. **Internal v3 conformance**: `<NotionRenderer/>` from `react-notion-x` over our `recordMap` matches captured reference renders < 1% pixel diff for every captured surface in `reference/screenshots/v3/`.
3. **Sync conformance**:
   - 50-concurrent-editor load test on a 1000-block page; convergence in < 30 s; keystroke ack p99 < 80 ms.
   - 24-hour offline-replay test with 5000 queued edits across 3 simulated devices; deterministic convergence.
4. **Public webhook conformance**: every event in the catalogue delivers a signed payload that a Vitest receiver verifies; auto-disable after 5 consecutive 5xx; full lifecycle audit.
5. **Pixel-perfect**: full checklist 100% ticked, including the data-source selector + the v3-driven public renderer.
6. **Benchmark**: final report with every endpoint, every UI interaction, every chart kind, every chart-config aggregation, every form submission, every webhook delivery, every v3 transaction kind. All under budget.
7. **Observability audit**:
   - Every code path: trace + log + metric.
   - Every error path: structured log with documented `code`.
   - Every webhook: delivery span + retry counter.
   - Every v3 transaction: `v3.submitTransaction` span with `ops.count`.
8. **Release artefacts**: PR, release tag, release notes attaching benchmarks + visual diffs + tour video + conformance reports.

## Todos

- [ ] 26.1 Public REST conformance via official SDK ≥ 2.4.0
- [ ] 26.2 Internal v3 conformance via `<NotionRenderer/>`
- [ ] 26.3 Sync conformance (50-editor + 24h offline replay)
- [ ] 26.4 Public webhook lifecycle conformance
- [ ] 26.5 Pixel-perfect checklist 100% across all surfaces
- [ ] 26.6 Final benchmark report under all budgets
- [ ] 26.7 Final observability audit
- [ ] 26.8 Release artefacts published

## Definition of Done

- Universal DoD.
- Every cross-cutting item in `docs/PLAN.md#cross-cutting` reaffirmed.
- The honest-scoping table in `docs/README.md#honest-scoping` is signed off: each row has its conformance test green or its documented behavioural-only target met.
- The CHANGELOG entry documents the final state and links every artefact.