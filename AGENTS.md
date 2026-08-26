# Project Operational Protocols & Workflow Guidelines

## 1. Automatic GitHub Sync & Deployment
- After completing every feature, fix, or rule update:
  - Run git status and check diffs.
  - Stage changes, create a clear and descriptive commit message.
  - Push changes to the GitHub remote (`origin main`), triggering automated Render deployment if configured.

## 2. Strict Prompt-to-Implementation Reconciliation
- Before wrapping up and replying on any task:
  - Carefully re-read the user's initial and subsequent prompt requirements.
  - Map every single requirement item by item against what was implemented/changed.
  - Confirm in the final response that all requested items are 100% complete with a clear checklist.

## 3. Zero Hallucination & Explicit Confirmation
- Never guess or unilaterally invent business rules, critical logic, or parameters.
- Whenever there is ambiguity, edge case confusion, or potential risk, explicitly ask the user for confirmation and clarification before modifying code.

## 4. Code Quality & Integrity
- Maintain backward compatibility where required.
- Do not remove or alter existing unrelated code, comments, or documentation.
- Test and verify changes locally before pushing.
