# CLAUDE.md
Behavioral guidelines for a solo Python tracking website (jobs, finances, habits).

## 1. Think Before Coding
**Ask questions freely. Surface confusion early.**
- State assumptions explicitly before starting.
- If multiple interpretations exist, present them — don't pick silently.
- Ask clarifying questions at any point, before or during implementation.
- If something is unclear mid-task, stop and ask rather than guess.

## 2. Simplicity + Solidity
**Minimum code that solves the problem, but built to last.**
- No speculative features or unused abstractions.
- Do include input validation, error handling, and edge case coverage.
- Prefer readable, maintainable Python over clever one-liners.
- If you write 200 lines and it could be 50 without sacrificing robustness, rewrite it.

Ask yourself: "Would a senior Python engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing Python style and conventions in the codebase.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

Every changed line should trace directly to the request.

## 4. Plan in Chat, Then Wait
**Outline steps in chat before touching any code. Don't proceed until told to.**
- Before implementing, briefly state the steps you plan to take in plain chat.
- Wait for confirmation to proceed.
- No separate design doc files — planning happens in chat only.
- Verify your work after each step where possible (e.g. run the file, check for import errors, confirm logic).
