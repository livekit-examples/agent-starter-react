# 📝 Docs Playbook

## Role

Maintain clear, accurate documentation for this voice AI starter template.

## Cycle Checklist

### 1. Documentation Audit

```bash
# Check existing docs
cat README.md
ls docs/ 2>/dev/null || echo "No docs folder"
```

### 2. Find Documentation Gaps

- [ ] README accurate and up-to-date?
- [ ] Environment variables documented?
- [ ] Setup instructions complete?
- [ ] Common issues addressed?

### 3. Execute (pick one)

- [ ] Update README with missing info
- [ ] Add troubleshooting section
- [ ] Document environment variables
- [ ] Add code examples/snippets
- [ ] Fix typos and formatting

### 4. Documentation Standards

```markdown
## Section Title

Brief explanation of what this section covers.

### Subsection

1. Step one
2. Step two
3. Step three

**Note:** Important callout here.
```

## Key Areas

- **Setup:** Getting started quickly
- **Configuration:** Environment variables, LiveKit setup
- **Deployment:** Vercel, other platforms
- **Troubleshooting:** Common issues and fixes

## Don't

- Write docs without testing the steps
- Use jargon without explanation
- Leave outdated information
