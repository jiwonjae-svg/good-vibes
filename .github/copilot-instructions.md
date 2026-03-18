# Copilot Instructions

## Project Context

This is **Daily Glow** — a React Native (Expo SDK 54) motivational quotes app with TypeScript, Zustand state management, Firebase backend, and RevenueCat subscriptions.

## Virtual Company System

This project uses a **virtual company** model in the `agents/` directory. The AI assistant operates as a team of specialized workers organized into departments, governed by shared rules, and informed by project documentation.

### Directory Structure

```
agents/
├── workers/    — 50 worker personas organized by department
├── project/    — Project-specific documentation (architecture, design system, etc.)
└── rules/      — Company-wide rules governing worker behavior
```

### Workers (`agents/workers/`)

Workers are **reusable personas** — they have no project-specific content and can be applied to any project. Each worker has a name, department, position, expertise, work style, communication approach, and personality traits.

**Departments:**
| Department | Focus | Count |
|------------|-------|-------|
| engineering | Frontend, backend, mobile, fullstack, platform | 15 |
| design | UI/UX, visual, motion, design systems, brand | 6 |
| product | Strategy, PM, growth, analytics | 5 |
| qa | Lead, automation, manual, performance | 5 |
| devops | Infrastructure, CI/CD, SRE, cloud | 5 |
| data | Analytics, data science, ML, data engineering | 5 |
| security | AppSec, compliance, security engineering | 4 |
| management | CTO, EM, scrum master, tech writer, agile coach | 5 |

**How to use workers:**
- Select relevant workers based on the task's domain (see `agents/rules/PARTICIPATION.md`)
- Workers participate contextually — backend engineers don't review frontend design, designers don't review database queries
- Workers verify information, suggest ideas, critique each other's proposals, and actively search for evidence
- Workers are creative yet meticulous; they design thoughtfully and challenge assumptions

### Project Documentation (`agents/project/`)

Before making changes, consult relevant project docs:

- **`ARCHITECTURE.md`** — Tech stack, directory structure, core application flows
- **`DATABASE.md`** — Firestore collections, security rules, AsyncStorage keys, quote data schema
- **`STATE-MANAGEMENT.md`** — All 5 Zustand stores with fields, actions, and badge thresholds
- **`DESIGN-SYSTEM.md`** — Color palette, typography, spacing, shadows, component patterns
- **`SYSTEMS.md`** — Modal queue, deep link, quote selection, ad, badge, notification, widget, community, and build systems
- **`SERVICES.md`** — All service files with function signatures and descriptions
- **`COMPONENTS.md`** — All 30+ components categorized with props and behavior
- **`ROADMAP.md`** — Current issues, improvement ideas, architecture direction

### Rules (`agents/rules/`)

Company rules that prevent chaos and ensure quality:

- **`PARTICIPATION.md`** — When workers engage, engagement levels, team assembly, escalation paths
- **`CODE-REVIEW.md`** — Review requirements by change type, review checklist, reviewer behavior
- **`COMMUNICATION.md`** — Discussion format, debate rules, decision-making authority, knowledge sharing
- **`QUALITY-STANDARDS.md`** — Code quality, testing, design, performance, and security standards
- **`WORK-PROCESS.md`** — Feature lifecycle, bug fix process, incident response

## Key Conventions

- **Language**: Korean is the primary UI language; all user-facing strings go through `i18n/locales/`
- **State**: Zustand v5 with `persist` middleware and AsyncStorage — never use React Context for global state
- **Modals**: All modals go through the centralized FIFO queue in `app/_layout.tsx`
- **Styling**: Use theme constants from `constants/theme.ts`; no inline magic numbers
- **Navigation**: Expo Router file-based routing with `(tabs)` group layout
- **Quotes**: Quote data in `data/quotesClient.json` (client) and `data/quotesServer.json` (server/Firestore)
