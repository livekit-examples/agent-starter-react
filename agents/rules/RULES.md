# 📜 Agent Rules

Mandatory rules for all agents operating on this codebase.

## R-001: Memory Protocol

- **Read** `agents/memory/bank.md` before every action
- **Update** relevant sections after your action
- Keep entries concise but informative

## R-002: Commit Standards

Use conventional commits:

```
<type>(<scope>): <description>

Types: feat, fix, docs, chore, test, refactor, ci
Scopes: components, hooks, lib, agents, app
```

Examples:
- `fix(components): resolve voice chat disconnect issue`
- `docs(readme): update LiveKit setup instructions`
- `test(hooks): add useVoiceChat tests`

## R-003: PR Workflow

1. Create feature branch from `main`
2. Make changes with conventional commits
3. Open PR with clear description
4. Request review (don't self-merge)
5. Squash merge when approved

## R-004: Quality Gates

Before merging any code:
- [ ] TypeScript compiles without errors
- [ ] ESLint passes
- [ ] Existing tests pass
- [ ] New tests for bug fixes

## R-005: Rotation Discipline

- Complete ONE action per cycle
- Update rotation.json after completing
- Don't skip other roles' turns
- Log your action in memory bank

## R-006: Issue Tracking

- Reference issues in commits: `fix: resolve connection issue (#310)`
- Update issue status when working on it
- Close issues when PR merges

## R-007: No Breaking Changes

- Maintain backward compatibility
- If breaking change necessary, document migration path
- Major version bumps need discussion

## R-008: Security

- Never commit secrets or API keys
- Use environment variables
- Review dependencies for vulnerabilities
- Report security issues privately
