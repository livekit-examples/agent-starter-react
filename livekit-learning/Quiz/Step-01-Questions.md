# Step 1 Quiz: Project Structure & Package.json

Test your understanding of LiveKit package basics before moving to Step 2.

---

## Question 1: The Two Packages

What are the **two main LiveKit packages** we added to `package.json`?

For each package, state:
- a) The package name
- b) Where it runs (browser or server)
- c) What it's used for

---

## Question 2: Why Two Packages?

Why does LiveKit have **two separate packages** instead of combining everything into one?

---

## Question 3: Security Risk

Imagine we tried to generate tokens directly in the browser (client-side) instead of on the server.

- a) What information would we need to expose to the browser?
- b) What could a malicious user do with that information?
- c) Why is this a security problem?

---

## Question 4: The Token Flow

Put these steps in the **correct order** (1, 2, 3):

- [ ] Browser connects to LiveKit Cloud using the token
- [ ] Server creates a signed JWT token using the API secret
- [ ] Browser requests a token from the server

---

## Question 5: Port Number

Looking at the `scripts` section in `package.json`:

```json
"scripts": {
  "dev": "next dev --turbopack -p 3001"
}
```

- a) What port will the app run on?
- b) Why did we choose this port instead of the default (3000)?

---

## Question 6: Dependencies vs DevDependencies

In `package.json`, we have both `dependencies` and `devDependencies`:

```json
"dependencies": {
  "livekit-client": "^2.15.15",
  "livekit-server-sdk": "^2.13.2",
  ...
},
"devDependencies": {
  "@types/node": "^22.0.0",
  "typescript": "^5"
}
```

- a) What's the difference between `dependencies` and `devDependencies`?
- b) Why is `typescript` in `devDependencies` and not `dependencies`?

---

## Question 7: Conceptual Understanding

True or False (and explain why):

1. "The `livekit-client` package can generate authentication tokens."
2. "Tokens contain information about which room a user can join."
3. "The browser needs the `LIVEKIT_API_SECRET` to connect to a room."

---

## Bonus Question

If you wanted to create a mobile app (iOS/Android) that connects to LiveKit, would you use `livekit-client` or `livekit-server-sdk`? Why?

---

**When you're done, check your answers in `Step-01-Answers.md`**
