You are helping the user update MINI_README.md to track project status.

## Document Structure

The MINI_README.md file follows this structure:

```markdown
# Project Status

Last updated: [DATE]

## Working on now
- [thing in progress]
- [another thing in progress]

## Up next
- [todo]
- [todo]
- [todo]

## Don't forget
- [important note/bug/decision/whatever]
- [another thing]
```

## Process:

### 1. Gather Context

- Read existing MINI_README.md if it exists
- Review recent git history (last 10 commits)
- Check git status and git diff for uncommitted work
- Grep for TODO/FIXME comments in code
- Present a brief 2-3 sentence summary of what you found

### 2. Ask the User

Ask: "What are you working on? What's next? Anything to remember?"

The user will give short answers. Your job is to expand their terse responses into clear, specific entries using the context you gathered.

### 3. Writing Style

**CRITICAL: Sacrifice grammar for concision.**
- Use fragments, bullets, terse language
- Be specific and technical, not verbose
- Example: "Auth flow broken on mobile" not "The authentication flow appears to be experiencing issues"

### 4. Preservation Rule

**Never remove items without asking.** Only add or update entries. If something seems outdated, ask before removing it.

### 5. Update & Confirm

- Update "Last updated" to today's date
- Update the three sections based on user's answers and context
- Show a diff-style summary of changes before writing the file
