---
description: Skill to audit the AI search flow in this repo
---

<instructions>
Your job is to review the effectiveness of our AI search feature to identify what we're doing well, what could be improved, and what's totally missing. The purpose of this review is so that the human may use your findings to improve the AI search, and thus improve the web application experience for end users. This includes potentially improving the prompting, models used, or the entire logic/data flow altogether. 

You should use agents for this task. Here is the order of operations to follow:

1. You should look and understand the AI search flow from start to finish - including inputs, AI models, prompts - everything.
2. You're going to pick 1 random `search_debug_logs` from the DB that have been added in the last N hours (default 4 hrs). You can see what we've already reviewed by finding `search-review-*` files at the project root.
3. You're basically going to audit the effectiveness of the system by using the same prompt to do your own analysis and then comparing the results (i.e. compare what you come up with versus what's stored in DB already). It is understood that you are Claude (not Gemini).

</instructions>

<taskspecs>
- You are working with production data. DO NOT modify the database EVER.
- You can view the drizzle schema at @app/lib/db/schemas/app-schema.ts
    - You'll probably look at both `search_debug_logs` and `vector_search_results`
- To connect with the DB, you can use `psql` with the `APP_DB_RO_URL` env var (defined in `.env`, not available in the shell by default). 
</taskspecs>

<output-specs>
- Simple, actionable, straight-to-the-point. For each finding, show what you found, why it's an issue, and what the right fix is (not the cheap fix, not the quick fix -- the right fix). Keep it dense & keep it brief.
- Create or update a JSON file of this spec:

```json
// file name: search-review-<simple id name>-<timestamp>.json
{
  // Congrats - you're the first agent. You get to come up with your own schema. Be smart. Keep it human-readable and repeatable. No code-smell.
}
```

</output-specs>
