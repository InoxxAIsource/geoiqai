---
name: GEO Copilot context pattern
description: How getFullBrandContext loads sprint/monitoring data and a TypeScript gotcha with Promise.all conditional queries
---

## Rule
`getFullBrandContext()` accepts a `brand` object with an optional `userId` field. When `userId` is present it loads sprint progress (`sprintSessionsTable`, `sprintProgressTable`) and answer monitoring prompts (`answerMonitoringPromptsTable`). Without it those fields return `null`.

Always spread the brand row and add `userId` at call sites:
```typescript
await getFullBrandContext({ ...brand, userId: user.id });
```

## TypeScript gotcha
When a conditional DB query is included in a `Promise.all` array alongside `Promise.resolve([])`, TypeScript infers the fallback as `never[]` and the resolved type of that position becomes `never[]`. This causes downstream `.find(p => p.id ...)` to see `p: never`.

**Fix:** extract the conditionally-loaded query outside of `Promise.all`:
```typescript
const [scoresRow, ...] = await Promise.all([...mainQueries]);
const monPrompts = userId ? await db.select()... : [];
```

**Why:** The `Promise.resolve([])` literal lacks a type parameter so TypeScript picks `never[]`. Drizzle's builder return type doesn't unify with `Promise<never[]>`, resulting in `never` for the whole position. Extracting it gives the conditional `await` a proper inferred type from the Drizzle query.

## Schema
- `sprintSessionsTable` — one row per (userId, domain) with `currentScore`
- `sprintProgressTable` — one row per (userId, domain, stepId) with `completed: boolean`
- `answerMonitoringPromptsTable` — one row per tracked prompt; join with `answerMonitoringResultsTable` (latest per promptId:llm) for SoV, sentiment, position
