# OnePage — Spec

> Living spec. Update it before changing what the app does. Items marked *(draft)* are Claude's best reading of the current app and need Riley's confirmation.

## What it is
A task manager where everything fits on one screen. Tasks are grouped by category, with a Today section, subtasks, recurring tasks and a monthly AI report on what you got done.

Hosted on Railway. Riley's first AI build.

## Who it's for
- Riley, for personal task tracking.
- Anyone who wants a fast, keyboard-friendly list without project-management overhead. Sign-ups are open.

## Core features (v1)
| Feature | Notes |
|---|---|
| One-screen layout | All categories and tasks visible at once |
| Today section | Quick access to what matters now |
| Categories | Custom, editable |
| Subtasks | Tab to indent, Shift+Tab to unindent |
| Multi-line paste | Paste several lines to create several tasks |
| Drag and drop | Move tasks between categories |
| Recurring tasks | Daily, weekly, monthly, quarterly |
| Archive | Completed tasks move to a reviewable archive |
| Monthly AI report | Claude summarizes what you finished; saved and regenerable |
| Accounts | Clerk |

## Must stay true
- Everything stays on one screen. No extra pages for core task work.
- Every task and report is scoped to the signed-in user.
- AI report generation stays capped to control spend.
- Fast: typing a task and pressing Enter should feel instant.

## Not building (v1) *(draft)*
- Teams, sharing or assigning tasks to others
- Due-date calendars or Gantt views
- Mobile apps (web only)
- Integrations with other task tools
- Paid plans

## Open questions
- Should OnePage move from Clerk to Better Auth to match ReflectAI?
