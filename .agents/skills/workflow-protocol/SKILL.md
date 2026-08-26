---
name: workflow-protocol
description: >-
  Standard operating procedure for completing coding tasks: auto-commit & push to GitHub after every feature, strict prompt reconciliation verification checklist at completion, zero hallucinations with proactive user confirmation on ambiguity, and deployment checks.
---

# Workflow Protocol Skill

This skill defines the mandatory operating procedure for working on features and updates.

## Execution Rules:

1. **Continuous Git Commit & Remote Push**:
   - As soon as a feature, rule, or fix is implemented and verified, stage and commit the changes.
   - Push to `origin main` (or the active remote tracking branch) so that live deployment platforms (like Render) receive updates.

2. **Final Verification & Prompt Reconciliation**:
   - Before completing each user request, re-read the exact prompt.
   - Cross-check each requested item against the actual implementation.
   - Include a concise verification checklist in the final reply confirming everything is addressed.

3. **Zero Assumption / Confirmation on Ambiguity**:
   - If a rule or requirement is unclear or could have multiple interpretations, ask the user for confirmation.
   - Do not hallucinate or invent rules/logic unilaterally.

4. **Safety & Verification**:
   - Verify code syntax and functionality before committing.
   - Ensure clean diffs without side-effects.
