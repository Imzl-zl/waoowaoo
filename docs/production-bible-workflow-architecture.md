---
name: Production Bible Workflow Architecture
description: Novel/manual prompt to AI film and TV pre-production assets
type: architecture
updated: 2026-05-27
---

# Production Bible Workflow Architecture

## Goal

Turn a novel or manual story prompt into durable pre-production assets before any image, video, voice, or edit generation runs. The product must support both automatic extraction and manual authoring without forcing a different downstream pipeline for each mode.

## Reference Model

Film and TV pre-production is not a single prompt-to-video step. The stable preparation layer should represent:

- Show / production bible: characters, plots, settings, themes, arcs, world rules, tone, and continuity.
- Script / scene breakdown: scene-level requirements such as cast, extras, props, set dressing, costumes, makeup, VFX, sound, music, and equipment.
- Episode plan: flexible episode count, target/min/max duration, pacing, beats, and cliffhanger strategy.
- Scene breakdown: dramatic purpose, location/time, characters, props, production elements, and continuity notes.
- Shot plan / storyboard: shot type, camera move, framing, duration, action/dialogue, image prompt, video prompt, references, and continuity notes.
- Human review points: explicit checkpoints for locking continuity and asking questions before expensive media generation.

## Decision

Use a contract-first production-prep layer:

```text
Novel / Manual Prompt
  -> ProductionPrepDocument
  -> Character / Location / Prop / Style Cards
  -> EpisodePlan
  -> SceneBreakdown
  -> ShotPlan
  -> Human Review
  -> Image / Video / Audio / Assembly
```

The same schema is used for both source modes:

- `sourceMode: "novel"` means the first node extracts assets from source text.
- `sourceMode: "manual"` means the first node normalizes user-authored premise, character, setting, style, or constraints into the same asset document.

## Options Considered

### Option A: Bind Current Novel Promotion Workers Directly

- Fastest path to reuse existing story/script/storyboard workers.
- Couples the new visual workflow product to one historical workflow shape.
- Makes manual-mode authoring and future film/TV workflows harder to evolve.

### Option B: Production-Prep Contracts Plus Workflow Nodes

- Adds a stable domain contract before wiring more UI and persistence.
- Keeps visual workflow DSL, node catalog, planner, and Temporal Activity boundaries intact.
- Allows existing novel-promotion data to be mapped in later without making it the only source of truth.

This is the selected option.

### Option C: Separate Full Film-Production Module Now

- Could model the target product deeply.
- Too large for the current foundation step.
- Risks duplicating workflow runtime, run state, media, provider, billing, and asset contracts.

## Current Implementation

- `src/lib/production-bible/` defines strict schemas, semantic validation, node-output parsing, and production node prompt construction.
- `story.extractBible`, `story.planEpisodes`, `scene.breakdown`, `shot.plan`, and `human.review` are first-class workflow node types.
- Node config schemas live in `src/lib/workflow-engine/node-config-catalog-production.ts`.
- Runtime support is registered through the existing published workflow executor map, so planner support and Activity dispatch stay in sync.
- Production planning nodes execute through the existing LLM Activity boundary and keep provider secrets in user/project model config.
- LLM output is strict-parsed into production-prep schemas before becoming the step artifact payload.
- `human.review` produces a review checkpoint artifact; it does not pretend approval happened. Future pause/resume should use the run-runtime/Temporal control boundary.

## Extension Points

- Add persistence tables or asset-library projections only after the schema has proven stable.
- Add manual UI editors by editing the same production-prep assets, not by inventing a second manual-only model.
- Add locks/versioning at the asset-card level so regenerated episodes, scenes, and shots respect approved continuity.
- Add Temporal signal-driven review/pause later; the current checkpoint artifact is the explicit placeholder.
- Add media nodes after shot plans, with prompts consuming production assets rather than whole novels.

## Rules

- Do not put provider credentials or model keys into production-prep documents.
- Do not execute draft definitions; only immutable published workflow versions can run.
- Do not treat unsupported production nodes as no-op.
- Do not pass full run history into every Activity. Current published workflow context remains direct dependencies only.
- If a node needs broader references later, extend the workflow data-scope contract explicitly.

## References

- StudioBinder script breakdown: https://www.studiobinder.com/blog/free-script-breakdown-sheet/
- StudioBinder production documents: https://www.studiobinder.com/film-production-documents/
- StudioBinder show bible: https://www.studiobinder.com/blog/what-is-a-show-bible-examples-template/
