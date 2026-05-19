# Plan: Process & Sequencing for Controllable IrisGrid Branches

> **Status note (branch `vlad-DH-21476-o4.7`)**: A/B/C spike evaluation is
> **paused**. The active deliverable on this branch is
> [DH-21476-05 — sidebar plugin extensibility](./DH-21476-05-sidebar-plugin-extensibility.md),
> which lands on top of Phase 0 without picking a controllability winner.
> Re-open this process plan once we have real plugin consumers and a
> concrete reason to choose between A, B, and C.
>
> Companion to [DH-21476-01-phase-0-foundation.md](./DH-21476-01-phase-0-foundation.md)
> and the three branch plans:
> [Branch A — imperative ref](./DH-21476-02-spike-branch-a-imperative-ref.md),
> [Branch B — expanded override](./DH-21476-02-spike-branch-b-expanded-override.md),
> [Branch C — idiomatic React rewrite](./DH-21476-03-spike-branch-c-idiomatic-react-rewrite.md).
>
> The framework plan defines **what** to build. This plan defines **how
> to evaluate and sequence the branches** without burning weeks on
> three parallel rewrites of the same 5500-line component.
>
> Filename uses a descriptive slug; rename to
> `DH-XXXXX-controllable-iris-grid-process.md` once a ticket is opened
> (see [iris/plans/README.md](../../iris/plans/README.md)).

## TL;DR

**Yes** — three parallel evaluation branches is the right call, and is
what this plan recommends. The constraint is that each branch is a
**time-boxed evaluation spike, not a production implementation**. Only
one branch survives the decision meeting and gets re-implemented on
`main`; the other two get archived.

1. Land [Phase 0](./DH-21476-01-phase-0-foundation.md#phase-0--shared-foundation-both-branches-build-on-this)
   on `main` first (sequential, non-breaking, useful by itself).
2. Cut **three short-lived spike branches** in parallel — A, B, and a
   feasibility-only C. Different shapes, different time-boxes, all
   running concurrently after Phase 0:
   - **A and B**: 1-2 weeks each, identical scope (3-4 representative
     fields + the [Create Pivot plugin](./DH-21476-02-spike-create-pivot-plugin.md)
     as the consumer). Comparable evaluation memos.
   - **C**: 2-3 days, architecture-only (one slice ported, no plugin
     work, no migration). Separate memo answering "is this buildable?"
     not "is this ergonomic?".
3. Hold one decision meeting. Pick A or B first based on the matched
   spikes; then ask the orthogonal C question (good enough, stepping
   stone, or skip A/B entirely).
4. Archive the losing branch plans. Open a per-field migration plan and
   land migrations a few fields per PR on `main`.

## What "parallel branches" should and shouldn't mean

Parallelizing the **evaluation** is good and recommended. The thing to
avoid is parallelizing the **production implementation** — i.e. trying
to carry all three branches forward as fully-migrated, integrated,
shippable versions of [IrisGrid](../packages/iris-grid/src/IrisGrid.tsx)
with the intent of merging the winner later. That path fails because:

- Three teams each maintaining a full port of `IrisGrid` against a
  fast-moving `main` produces a constant rebase tax.
- Three sets of conformance tests touch the same registry — any
  registry change is a three-way merge.
- Plugin authors (in-tree dashboard plugins, deephaven-plugins/ui,
  simple-pivot) end up tracking three APIs and likely give no useful
  feedback on any branch.
- The decision meeting becomes a sunk-cost argument, not a real
  comparison.

The **evaluation spike** model below avoids all four. Each spike has a
hard time-box, a fixed minimal scope, and is **abandoned after
evaluation** — the winner gets re-implemented on `main` from the
spike's lessons rather than promoted. That keeps the rebase, registry,
and plugin-author costs proportional to evaluation, not to a full
rewrite.

The cost of evaluation should also be proportional to the cost of being
wrong. Branches A and B have similar evaluation cost (thin spike,
plugin built on top); Branch C is a rewrite, so its evaluation is
shaped differently — architecture feasibility, not ergonomics.

---

## Step 1 — Land Phase 0 on `main` (sequential)

Phase 0 is a hard prerequisite for both A and B and is genuinely
useful by itself. Specifically:

- Controllable-fields registry
  ([DH-21476-01-phase-0-foundation.md, Phase 0 #1](./DH-21476-01-phase-0-foundation.md#phase-0--shared-foundation-both-branches-build-on-this))
  — also Branch C's source of truth for `IrisGridState`. Not wasted
  even if C wins.
- Normalized `applyX(value, source)` mutators (Phase 0 #2) — clean-up
  worth doing regardless.
- Granular `onStateDidChange` (Phase 0 #3) — additive, opt-in.
- Sidebar mutations funneled through `applyX` + register `isMenuShown`
  / `openOptions` (Phase 0 #7, the corrected version) — also
  prerequisite for the [Table Options sidebar plugin plan](./DH-21476-04-post-decision-table-options-plugin.md).

Ship as a normal series of PRs on `main`. No feature branch. No need
for branch plans to exist before Phase 0 lands.

**Exit criteria.** Phase 0 is "done" when:

- The registry exists and every `IrisGridState` field that's not
  explicitly excluded is in it.
- Every `handleX` / `setX` / direct `setState` for a registered field
  routes through the corresponding `applyX(value, 'user')`.
- `onStateDidChange` fires in conformance with the registry (covered
  by the parametric test from the parent plan's Phase C #1).
- Existing snapshot and unit tests still pass; no behavior changes
  intended.

---

## Step 2 — Spike branches for A and B (parallel, time-boxed)

**After Phase 0 lands**, cut two feature branches off `main`:

- `spike/controllable-iris-grid-branch-a` — Branch A pattern.
- `spike/controllable-iris-grid-branch-b` — Branch B pattern.

### Spike scope (identical for both)

Implement the chosen pattern for **3-4 representative fields**, picked
to surface different failure modes:

1. A trivial scalar: `setReverse` (boolean toggle).
2. A model-swapping field: `setRollupConfig` (`UIRollupConfig | undefined`).
3. A multi-field batched mutation: visibility ordering's
   `movedColumns` + `userColumnWidths` (drag-and-drop reorder).
4. A transient view field: `openSidebar(option)` /
   `closeSidebar()` (exercises the sidebar-navigation control from
   Phase 0 #7).

Then build the [Create Pivot plugin](./DH-21476-02-spike-create-pivot-plugin.md)
on top of each spike. That plan was explicitly designed as a minimal
real consumer; reusing it makes the spikes directly comparable.

### Spike non-goals

- **Don't migrate every field.** Extrapolation from 4 fields is
  enough to estimate the full delta.
- **Don't ship deprecations** or touch `@deprecated` JSDoc — spikes
  aren't shipping.
- **Don't migrate `FilterSetManagerPanel`** or any other in-tree
  consumer. Single-purpose spikes only.
- **Don't write the `useIrisGridState` hook (Branch A)** or
  `IrisGridControllerPanel` (Branch B) beyond what the Create Pivot
  plugin needs. Those polish items are evaluated on paper, not built.

### Resourcing

One engineer per branch, **~1-2 weeks each, run in parallel**. Hard
time-box. If a spike isn't done in 2 weeks, that itself is a data
point against the branch.

### Evaluation criteria (answers Phase D in the parent plan)

For each spike, record:

| Dimension | How to measure |
| --- | --- |
| Lines of code per migrated field | Count `+` / `-` per field in the spike PR; extrapolate to full registry. |
| Plugin DX | Time to write the Create Pivot plugin from scratch (timer + screen recording). Note every API friction. |
| Render counts | React DevTools Profiler on a typical session: open grid, sort, filter, rollup. Compare to baseline (Phase 0). |
| Real bugs surfaced | Loop hazards, ref-timing issues, memoization holes. Each one is a Phase D bullet. |
| Snapshot churn | Number of Jest snapshots regenerated. |
| Test cost per field | Lines added to conformance suite per registered field. |

Both spikes write a **one-page evaluation memo** (in the spike branch,
not in `plans/`) summarizing these numbers. The memo is the
deliverable, not the spike code itself.

### Spike disposition

After evaluation, **abandon both spike branches**. Don't try to
upgrade either spike into the production implementation — they were
built fast and skipped corners. The winner gets re-implemented on
`main` from the spike's lessons.

---

## Step 3 — Branch C feasibility spike (parallel, separate shape)

Branch C is a rewrite, not a refactor. A 1-2 week spike can't
deliver useful ergonomic data — it would just be 5% into the rewrite.
So Branch C runs **in parallel with Step 2** but with a different
shape: feasibility only, not ergonomics.

- **2-3 day design-only spike**, off `main` after Phase 0 lands.
- Stand up `createIrisGridStore` (Branch C's [Phase C.1](./DH-21476-03-spike-branch-c-idiomatic-react-rewrite.md#phase-c1--define-the-store))
  for the same 3-4 fields chosen in Step 2.
- Port **one slice** (recommend sorts) of the rendering surface to
  function-component shape, behind `IRIS_GRID_V2` flag.
- Confirm the store-library decision (Branch C's [Phase C.0](./DH-21476-03-spike-branch-c-idiomatic-react-rewrite.md#phase-c0--decision-store-implementation)).
- **No plugin work, no migration, no compat shim.**

Use this to validate the architecture is **buildable**, not to
evaluate **ergonomics**. The spike's deliverable is a one-page memo
answering:

- Does the store-library choice (Zustand recommended) integrate
  cleanly with the existing `IrisGridProxyModel` / `IrisGridModelUpdater`
  effect chain?
- Does selector-scoped subscription actually reduce re-render counts
  vs. baseline? (Profiler comparison.)
- Where does the model-effect ordering (today encoded in
  `componentDidUpdate`) want to live in the new shape?
- Rough LOC delta extrapolated from the one ported slice.

Resourcing: third engineer running concurrently with Steps 2a/2b is
ideal. If only two engineers are available, slot Step 3 in immediately
after one of the A/B spikes finishes — it's small enough that ordering
doesn't materially affect the decision.

---

## Step 4 — Decide and converge

After Steps 2 and 3, hold one decision meeting with:

- The two A/B evaluation memos.
- The Branch C feasibility memo.
- The Create Pivot plugin author's DX notes.
- Render-count comparisons.

Decide in this order:

1. **Pick A or B** based on the spike data. (The Create Pivot plugin
   is the tiebreaker — whichever made it easier wins.)
2. **Then ask the orthogonal question**: is the chosen A/B winner
   *good enough*, or does Branch C's ceiling justify its cost?

Possible outcomes:

- **Pick A or B, ship it.** Most likely. Branch C plan stays
  on file as a future direction.
- **Pick A or B as a stepping stone, plan Branch C as a follow-up
  major.** Acceptable if the chosen winner clears short-term blockers
  but the team wants C's ceiling.
- **Skip A/B, do Branch C directly.** Rare. Justified only if both
  spikes hit the same architectural wall the rewrite would solve.
- **Do nothing yet.** Acceptable if the spikes reveal that current
  consumers don't actually need this much controllability. Capture
  why in the parent plan.

After the decision:

- Move the two losing branch plans to `plans/archive/` so future
  readers don't get confused. Update the parent plan to point only at
  the winner.
- Open a per-field migration plan (parent plan's "Migration: framework
  first, per-field migration in later plans"). Land migrations a few
  fields per PR on `main`. Phase 0's `applyX` normalization makes each
  migration mechanical.
- If Branch C was picked but B/A delivered earlier work, treat that
  work as Phase 0+; don't throw it away.

---

## Concrete next actions

1. **Open a Phase 0 ticket now.** No branch creation, no spike
   coordination yet. Ship Phase 0 to `main` over the next ~2-4 weeks.
2. **As Phase 0 nears landing, schedule the three spikes in parallel.**
   Two engineers for Steps 2a/2b, a third (or rotated time from one of
   the first two) for Step 3. Pre-agree the evaluation memo template
   so all three spikes produce comparable artifacts (with C's memo
   focused on feasibility instead of ergonomics).
3. **Hold the decision meeting within ~1 week of the last spike memo
   landing.** Don't let the memos rot — fresh recall of the spike
   experience is a big input.
4. **Within one sprint of the decision**, archive the losing branch
   plans and open the per-field migration ticket. Avoid the limbo
   where the chosen branch is "decided" but no migration is in
   flight.

---

## Risks specific to this process

| Risk | Mitigation |
| --- | --- |
| Spikes overrun the time-box; evaluation gets pushed | Hard 2-week limit. If incomplete, evaluate what's done — incompleteness is a data point. |
| One spike author optimizes harder than the other; comparison is unfair | Both authors agree on the field list and the Create Pivot plugin scope before starting. Same evaluation template. |
| Decision meeting devolves into preferences debate | Memos must include numbers (LOC, render counts, time-to-plugin). Decision is anchored on those, not on aesthetics. |
| Phase 0 starts drifting toward "Phase 0+" with bits of A or B leaking in | Phase 0 PRs reference the framework plan only. Reviewers reject anything that takes a position on the controllability model. |
| Branch C feasibility spike turns into a full rewrite | Hard 3-day cap. One slice only. The deliverable is a memo, not running code. |
| Plugin authors (deephaven-plugins/ui, simple-pivot) wait out the decision | Loop them in **before** Step 2: they review the Create Pivot plugin code in both spikes and contribute to the DX evaluation memo. |
| Losing branch plans linger and confuse future readers | Move to `plans/archive/` as part of the decision PR, not "later". |
