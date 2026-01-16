---
name: generate-quiz
description: Generates quiz questions and answers for LiveKit learning steps. Use after completing a step in the learning plan, when the user says "generate quiz", "create quiz", or "quiz for step X".
allowed-tools: Read, Write, Glob
---

# Generate Quiz Skill

This skill creates comprehensive quiz questions and detailed answers for each step in the LiveKit learning journey.

## Instructions

When triggered, follow these steps:

### 1. Identify the Step Number

- If the user specifies a step (e.g., "quiz for step 2"), use that step number
- If not specified, read `Docs/PLAN.md` and find the most recently completed step (marked with `[x]` or `✅`)

### 2. Read the Step Details

From `Docs/PLAN.md`, extract for the target step:
- **What we're doing** - The task description
- **Files** - The files created/modified
- **What you'll learn** - Key learning points
- **Key code to understand** - Any code snippets shown
- **Review after completing** - Questions already suggested

### 3. Read the Actual Implementation

Read the files created in that step to understand:
- The actual code written
- Comments explaining the code
- Patterns and concepts demonstrated

### 4. Generate Questions File

Create `livekit-learning/Quiz/Step-{NN}-Questions.md` with:

```markdown
# Step {N} Quiz: {Topic}

Test your understanding of {topic} before moving to the next step.

---

## Question 1: {Conceptual Question}
{Question about the main concept}

---

## Question 2: {Why Question}
{Question asking WHY something is done a certain way}

---

## Question 3: {Code Understanding}
{Question about specific code, showing a snippet}

---

## Question 4: {Practical Application}
{Question about when/how to use this in practice}

---

## Question 5: {True/False or Multiple Choice}
{Verification question with options}

---

## Question 6: {Connection Question}
{How does this connect to previous steps or upcoming concepts?}

---

## Bonus Question
{Advanced question for deeper understanding}

---

**When you're done, check your answers in `Step-{NN}-Answers.md`**
```

### 5. Generate Answers File

Create `livekit-learning/Quiz/Step-{NN}-Answers.md` with:

```markdown
# Step {N} Answers: {Topic}

Detailed explanations for each question.

---

## Answer 1: {Topic}

**{Short answer}**

{Detailed explanation with:}
- Why this matters
- Code examples if relevant
- Diagrams using ASCII art if helpful
- Common misconceptions

---

[Continue for all questions...]

---

## Summary: Key Takeaways from Step {N}

1. {Takeaway 1}
2. {Takeaway 2}
3. {Takeaway 3}

---

**Ready for Step {N+1}? Move on to {next step topic}!**
```

### 6. Update Quiz README

Update `livekit-learning/Quiz/README.md` to show the new quiz is available.

### 7. Confirm Completion

Tell the user:
- Which step's quiz was created
- How many questions were generated
- Where to find the files
- Remind them to try the questions before looking at answers

## Question Types to Include

Generate a mix of these question types:

1. **Conceptual** - "What is X and why is it used?"
2. **Why Questions** - "Why do we do X instead of Y?"
3. **Code Reading** - "What does this code do?"
4. **Practical** - "When would you use X?"
5. **True/False** - "True or false: X can do Y"
6. **Connection** - "How does X relate to Y from Step N-1?"
7. **Troubleshooting** - "What would happen if X was missing?"

## Answer Quality Guidelines

Each answer should include:
- **Direct answer** first (bold)
- **Explanation** of why
- **Code examples** where relevant
- **ASCII diagrams** for complex concepts
- **Common mistakes** to avoid
- **Connection** to the bigger picture

## Example Output

For Step 2 (TypeScript Config), questions might include:
- What is a path alias and why use `@/`?
- What does `strict: true` do in TypeScript?
- Why is `tsconfig.json` needed for a Next.js project?

Answers would explain each concept with examples from the actual files created.
