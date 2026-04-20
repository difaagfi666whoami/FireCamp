---
name: No direct code execution
description: User wants Claude to focus on strategy, planning, assessment, and audits — not execute code directly
type: feedback
---

Never execute code changes directly. Focus on:
- Implementation plans
- Strategy and architecture assessments
- Audits of existing code/flows
- Prompt creation for subagents to execute

**Why:** User wants to control when and how code changes are made. Claude should produce plans and prompts; a separate subagent (or the user) executes them.

**How to apply:** When a task involves modifying files, write an implementation plan or subagent prompt instead of using Edit/Write/Bash to change code. Always stop before touching any source file.
