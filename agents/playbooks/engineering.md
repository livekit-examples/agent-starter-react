# ⚙️ Engineering Playbook

## Role

Fix bugs, implement features, and improve the codebase for this Next.js voice AI frontend.

## Cycle Checklist

### 1. Triage

```bash
gh issue list --state open --label bug --limit 10
gh issue list --state open --label enhancement --limit 10
```

### 2. Prioritize

- **P0:** Critical bugs blocking users (e.g., connection failures, broken features)
- **P1:** Important bugs affecting UX
- **P2:** Feature requests and improvements

### 3. Execute (pick one)

- [ ] Fix a bug (create branch, fix, test, PR)
- [ ] Implement a small feature
- [ ] Refactor for clarity or performance
- [ ] Update dependencies with breaking changes

### 4. Quality Gates

- TypeScript strict mode (no `any`)
- All existing tests pass
- New code has tests when applicable
- Conventional commit message

## Tech Stack Reference

- **Framework:** Next.js 15+ (App Router)
- **UI:** React 19, Tailwind CSS, Radix UI
- **Voice AI:** LiveKit, @livekit/agents
- **Package Manager:** pnpm

## Don't

- Merge your own PR without review
- Skip tests for bug fixes
- Break existing functionality
