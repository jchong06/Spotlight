# Contributing to Spotlight

Thanks for your interest in contributing! Spotlight is a React app for finding
live EDM shows near you. Contributions of all kinds are welcome — bug reports,
feature ideas, docs, and code.

## Getting started

```bash
npm install
cp .env.example .env   # fill in your keys — see README.md
npm run dev
```

See [`README.md`](README.md) for the full setup, including Supabase and the
Ticketmaster / SeatGeek API keys.

## Ways to contribute

- **Report a bug** — open an issue with steps to reproduce, expected vs. actual
  behavior, and your OS/browser.
- **Suggest a feature** — open an issue describing the problem it solves.
- **Submit code** — fork the repo, create a branch, and open a pull request.
- **Good first issues** — check the [`good first issue`](https://github.com/jchong06/Spotlight/labels/good%20first%20issue)
  label for approachable starting points.

## Pull request process

1. Fork the repository and create a branch from `main`
   (`git checkout -b feat/short-description`).
2. Make your change. Keep PRs focused — one logical change per PR.
3. Match the existing code style (React 18, Tailwind CSS v4). Run `npm run build`
   to confirm the app still builds.
4. Write a clear PR description: what changed and why. Link any related issue.
5. Open the PR against `main`. A maintainer will review it.

## Commit messages

Use short, present-tense summaries (e.g. `Add venue search debounce`). Reference
issues where relevant (`Fixes #12`).

## Code of conduct

By participating, you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).
