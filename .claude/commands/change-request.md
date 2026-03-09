---
argument-hint: [change request(s)]
description: Plan out & implement changes
---

I am about to give you one or more change requests. For each, here are the steps you should execute:

1. Perform each in a separate agent
1. Read the change request
1. If you haven't yet, understand the change request by analyzing current conversation history
1. If you haven't yet, understand the change request by finding the relevant piece in the codebase, and understanding how that fits into the larger system.

After analysis, if the ask is still unclear or ambiguous, you may simply respond with follow up questions. Otherwise, you may plan and then implement.

Use your best judgement on whether an ask is simple and doable without bugging the user again, or whether it truly needs follow up questions.

When responding, explaining, answering, or asking questions, be concise - always sacrifice grammar for conciseness.

When you are done, give a quick summary of each change with relevant file locations. If there are no remaining follow up questions, you should ask for the next change requests or any fixes to the changes you made and then follow this prompt again. If the user responds to that with a complaint about a change you previously did, address that. If they say you edited the wrong thing, make sure you revert before making the right fix. Don't use git for reverting - just use the conversation history.

Here is/are the change request(s): $1
