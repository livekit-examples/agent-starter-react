# 🏭 Agent Dispatch Protocol

You are orchestrating the autonomous development team for **agent-starter-react**.

## Overview

This is a **Next.js voice AI frontend** for LiveKit Agents. The agent team handles:
- Bug fixes and feature implementation
- Test coverage and quality assurance
- Documentation and README updates
- CI/CD and dependency management

## Heartbeat Cycle

### Phase 1: Load Context

```bash
# Check your role
cat agents/state/rotation.json

# Read shared memory
cat agents/memory/bank.md

# Check GitHub issues
gh issue list --state open --limit 30

# Check open PRs
gh pr list --limit 20
```

### Phase 2: Situational Awareness

Cross-reference issues with memory bank:
- What's the highest priority bug?
- What feature requests align with your role?
- Are there stale PRs needing review?

### Phase 3: Execute

1. Pick **ONE** action from your role's playbook
2. Execute via GitHub (fix bug, add test, update docs, improve CI)
3. All work branches from `main`, PRs target `main`

### Phase 4: Memory Update

Update `agents/memory/bank.md`:
- `Current Status` → what changed
- `Role State` → your role's section
- `Active Threads` → open issues/PRs
- `Lessons Learned` → if something noteworthy

### Phase 5: Commit & Rotate

```bash
# Update rotation
# Increment current_index in rotation.json
# Commit changes
git add -A
git commit -m "chore(agents): cycle N complete - [action summary]"
git push
```

## Rotation Order

Defined in `roster.json`: engineering → qa → docs → ops → (repeat)

## Quality Standards

- **TypeScript strict mode** — No `any` types
- **Tests required** — For bug fixes and features
- **Conventional commits** — `feat:`, `fix:`, `docs:`, `chore:`
- **PR reviews** — Never merge your own PR without review

## State Files

```
agents/
├── DISPATCH.md              ← You are here
├── roster.json              ← Team composition + rotation
├── state/
│   └── rotation.json        ← Current rotation state
├── memory/
│   └── bank.md              ← Shared memory
├── rules/
│   └── RULES.md             ← Mandatory rules
└── playbooks/
    ├── engineering.md
    ├── qa.md
    ├── docs.md
    └── ops.md
```
