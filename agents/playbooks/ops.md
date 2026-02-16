# 🛡️ Ops Playbook

## Role

Manage CI/CD, dependencies, security, and release processes.

## Cycle Checklist

### 1. Health Check

```bash
# Check for security vulnerabilities
pnpm audit

# Check for outdated dependencies
pnpm outdated

# Review CI status
gh run list --limit 5
```

### 2. Dependency Review

```bash
# Check renovate.json config
cat renovate.json

# Check for pending dependency PRs
gh pr list --label dependencies
```

### 3. Execute (pick one)

- [ ] Update patch/minor dependencies
- [ ] Fix security vulnerabilities
- [ ] Improve CI/CD workflow
- [ ] Add/update GitHub Actions
- [ ] Review and merge renovate PRs

### 4. CI/CD Patterns

```yaml
# Example workflow improvement
- name: Type check
  run: pnpm type-check

- name: Lint
  run: pnpm lint

- name: Test
  run: pnpm test
```

## Security Guidelines

- Keep dependencies updated (especially security patches)
- Review Renovate PRs promptly
- Check for exposed secrets in commits
- Use environment variables for sensitive data

## Don't

- Update major versions without testing
- Disable CI checks
- Ignore security warnings
