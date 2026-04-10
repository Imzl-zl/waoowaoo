# Baseline Command Extracts

Captured at `2026-04-10 12:32 CST`.

## Environment snapshot

```text
$ test -d node_modules && echo present || echo missing
missing

$ find tests -type f \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.integration.test.ts' \) | wc -l
271

$ find src -type f | wc -l
924
```

## Guard results

```text
$ npm run check:api-handler
[api-route-contract-guard] OK routes=141 public=6 apiHandlerExceptions=3

$ npm run check:test-coverage-guards
[test-behavior-quality-guard] OK files=24
[test-route-coverage-guard] OK routes=141
[test-tasktype-coverage-guard] OK taskTypes=40
[test-behavior-route-coverage-guard] OK routes=141 tests=9
[test-behavior-tasktype-coverage-guard] OK taskTypes=40 tests=7

$ npm run check:no-api-direct-llm-call
[no-api-direct-llm-call] OK
```

## Size budget failure

```text
$ npm run check:file-line-count
[file-line-count-guard] FAIL: file size budget exceeded
- [component] src/app/[locale]/profile/components/api-config/hooks.ts: 795 > 500
- [component] src/app/[locale]/profile/components/api-config/provider-card/hooks/useProviderCardState.ts: 833 > 500
- [component] src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/script-view/ScriptViewAssetsPanel.tsx: 888 > 500
- [hook] src/lib/query/hooks/run-stream/state-machine.ts: 587 > 400
- [worker-handler] src/lib/workers/handlers/story-to-script.ts: 610 > 300
- [worker-handler] src/lib/workers/handlers/script-to-storyboard.ts: 565 > 300
- [mutation] src/lib/query/mutations/character-base-mutations.ts: 406 > 300
... and more
```

## Top large files

```text
$ rg --files src lib scripts tests prisma | xargs wc -l | sort -nr | head -n 25
1908 src/app/api/user/api-config/route.ts
1201 src/lib/assets/services/asset-actions.ts
1199 src/lib/run-runtime/service.ts
1080 src/lib/billing/service.ts
1001 prisma/schema.prisma
982 src/lib/async-poll.ts
898 src/lib/user-api/provider-test.ts
887 src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/script-view/ScriptViewAssetsPanel.tsx
874 src/lib/llm/chat-stream.ts
832 src/app/[locale]/profile/components/api-config/provider-card/hooks/useProviderCardState.ts
794 src/app/[locale]/profile/components/api-config/hooks.ts
732 src/components/ui/icons/custom.tsx
730 src/lib/workers/shared.ts
714 src/lib/workers/text.worker.ts
707 src/lib/workers/utils.ts
```

