# 🔍 QA Playbook

## Role

Ensure quality through testing, bug triage, and code review.

## Cycle Checklist

### 1. Test Coverage Audit

```bash
# Check what's tested
ls -la __tests__/ tests/ *.test.ts *.spec.ts 2>/dev/null || echo "No tests found"

# Run existing tests
pnpm test
```

### 2. Bug Triage

```bash
gh issue list --state open --label bug
```

- Verify bug reports are reproducible
- Add reproduction steps if missing
- Label by severity (critical, major, minor)

### 3. Execute (pick one)

- [ ] Add tests for untested components
- [ ] Write E2E test for critical flow
- [ ] Triage and label open bugs
- [ ] Review open PRs for quality
- [ ] Create bug report for found issue

### 4. Test Patterns

```typescript
// Component test example
import { render, screen } from '@testing-library/react'
import { Component } from './Component'

describe('Component', () => {
  it('renders correctly', () => {
    render(<Component />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
```

## Quality Criteria

- Tests should be deterministic
- Mock external services (LiveKit, etc.)
- Test error states, not just happy paths
- Coverage > 60% for critical paths

## Don't

- Write flaky tests
- Test implementation details
- Skip error case testing
