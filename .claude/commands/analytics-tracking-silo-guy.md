---
argument-hint: [app-type] [tracking-scope]
description: Design and implement analytics tracking as expert consultant
---

# Analytics Tracking Implementation

Act as **analytics expert consultant**, not just implementer. Track what clients care about (completion rates, drop-offs, ROI), not vanity metrics.

---

## Critical Rules

**Consultation:**

- Explore codebase to understand app
- Recommend tracking plan BEFORE implementing
- Challenge noisy/low-value events
- Wait for approval

**Communication:**

- Sacrifice grammar for conciseness
- Short, direct responses
- No fluff or verbose explanations

**Implementation:**

- Surgical changes only (add tracking calls, nothing else)
- Type-safe event definitions
- No refactoring, no UI changes, no feature additions
- No verbose docs (code is self-documenting)
- **IGNORE GTM code** - separate from Segment
- Server-side file (`analytics.defaults.server.ts`) is placeholder - use client-only unless explicitly needed

**Avoid Tracking:**

- Field-level changes (too noisy)
- Individual errors (use aggregate counts)
- Every click (not actionable)
- Redundant events

**NEVER Manually Add (Auto-Captured by @segment/analytics-next):**

- **UTM parameters** - `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` (auto in `context.campaign`)
- **Page properties** - `title`, `path`, `url`, `referrer`, `search` (auto in `context.page`)
- **User agent/device** - `userAgent`, `locale`, browser, OS (auto in `context`)
- **Anonymous ID** - `anonymousId` (auto-generated UUID in localStorage)
- **Library info** - SDK name/version (auto in `context.library`)
- **IP address** - IPv4 (auto-captured, not IPv6)

**Event Types:**

- **track()** - User actions/events (Form Submitted, Button Clicked, Feature Used)
- **page()** - Page views (automatic or manual). Don't use track() for page views
- **identify()** - User identification (login, register, newsletter signup, profile update)
  - userId auto-attaches to ALL subsequent events → enables user attribution
  - Call on: login, registration, newsletter signup, OAuth callback, profile update
  - Not just auth - anywhere you learn user identity

---

## Workflow

### Phase 1: Discover

**Identify app type:**

```bash
# Forms?
ls /app/lib/forms/*.ts 2>/dev/null | wc -l
grep -r "defineForm\|multiPageForm" /app/lib/ --include="*.ts*"

# E-commerce?
grep -r "checkout\|cart\|product" /app/routes/ --include="*.tsx" -i

# SaaS?
grep -r "dashboard\|subscription\|billing" /app/routes/ --include="*.tsx" -i

# Check analytics
ls /app/lib/analytics/ 2>/dev/null
cat /app/lib/analytics/events*.ts 2>/dev/null

# Check for page tracking (should exist, don't duplicate)
grep -r "analytics.page\|browserPageEvent" /app/ --include="*.tsx"

# Check auth (for identify calls)
ls /app/lib/auth*/ 2>/dev/null
grep -r "login\|oauth\|register\|signup" /app/routes/ --include="*.tsx"
```

**Output summary:**

```markdown
## Discovery

**App Type:** [form-app / e-commerce / saas / marketing]
**Key Flows:** [list main user journeys]
**Analytics:**

- SDK: [None / Segment / RudderStack]
- Event definitions: [Yes/No]
- Page tracking: [Yes - automatic / No - needs setup]
- Identify calls: [Yes / No / Partial]
  **Auth:** [Yes/No] - [Identify opportunities: login, register, etc.]
```

**If scope missing, ask:**

```
Track:
1. full-app
2. specific-feature (e.g., checkout-flow)
3. form:{id}
4. custom

Recommend: [based on discovery]
```

---

### Phase 2: Recommend

Act as analytics consultant. Start with business outcomes, derive events from those.

**Step 1: Define Outcomes**

What does success mean? What do clients want to measure?

```markdown
## Outcomes

**Outcome 1: [Name]** (e.g., "Form Completed")

- Type: direct / derived
- Definition: [How to measure]
- Has conversion rate: Yes/No
- Why clients care: [Business impact]

**Outcome 2: [Name]** (e.g., "Order Placed")

- Type: direct / derived
- Definition: [e.g., "Checkout Started + Payment Succeeded"]
- Has conversion rate: Yes
- Why clients care: [Revenue metric]

[... 3-5 key outcomes total ...]
```

**Step 2: Design Funnels**

How do users achieve outcomes? Where do they drop off?

```markdown
## Funnels

**Funnel: [Outcome Name]**
Steps:

1. [Entry event] → [X] users
2. [Step 2] → [Y] users (Z% drop-off)
3. [Step 3] → [W] users
4. [Success event] → [V] users

Drop-off analysis shows [insight]
```

**Step 3: Determine Segments**

How to slice outcomes for insights?

```markdown
## Segments

**REMINDER:** Device, browser, OS, referrer, UTMs auto-captured by analytics-next. Only add custom segments not in context.

**Language** (en/fr)

- Why: Translation quality affects conversion
- Applied to: [which outcomes]
- Note: Custom prop (not auto-captured)

**[Custom Segment]** (value1/value2)

- Why: [business reason]
- Applied to: [which outcomes]
```

**Step 4: Derive Events**

What events calculate outcomes + funnels + segments?

```markdown
## Recommended Events

**[Event Name]**

- Fires: [when]
- Needed for: [which outcome/funnel]
- Properties: `prop` (type) - [enables which segment]
- Client Value: [what decision]

[... all derived events ...]

## NOT Tracking

- **[Event]** - [why: noisy/not actionable/redundant]
- **UTM/page/device props** - auto-captured by analytics-next (context.campaign, context.page)

## Implementation

- [Setup steps]

## Trade-offs

- Performance: [assessment]
- Privacy: [PII]
- Signal/Noise: [balance]

---

**Approval:** "implement" / "add [event]" / "remove [event]"
```

**WAIT FOR APPROVAL**

---

### Phase 3: Implement

#### A. Setup (if needed)

**If no SDK:**

- Install: `bun add @segment/analytics-next use-debounce`
- Add Segment script to root layout
- Create `/app/lib/analytics/analytics.defaults.client.ts`
- Create `/app/lib/analytics/analytics.defaults.server.ts` (placeholder - rarely used)
- Set up automatic page tracking in root layout (see pattern below)

**Always create:**

- `/app/lib/analytics/events.defaults.client.ts` - Type-safe event definitions
- `/app/lib/analytics/session-utils.ts` - Session tracking (if tracking sessions)

**Page tracking setup (in root.tsx App component):**

```tsx
import { useEffect } from "react";
import { useLocation } from "react-router";
import { useDebouncedCallback } from "use-debounce";
import { browserPageEvent } from "~/lib/analytics/events.defaults.client";
import { useI18n } from "~/hooks/use-i18n";

function App() {
  const { language } = useI18n();
  const location = useLocation();
  const pathname = location.pathname;

  const triggerPageEvent = useDebouncedCallback(
    () => {
      browserPageEvent({ language });
    },
    1000,
    { leading: true, trailing: false }
  );

  useEffect(() => {
    triggerPageEvent();
  }, [pathname, language]);

  return <Outlet />;
}
```

**If auth exists but no identify:**

- Add identify() calls on login, register, OAuth callback
- Remember: userId auto-attaches to all future events

**Event definitions pattern:**

```typescript
export type TrackEvents = {
  "Event Name": {
    property: string;
    property2: number;
  };
};

export function browserTrackEvent<E extends keyof TrackEvents>(eventName: E, eventProps: TrackEvents[E]) {
  analyticsBrowser.track(eventName, eventProps ?? {});
}

export function browserIdentifyEvent(eventProps: {
  userId?: string;
  email: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
}) {
  if (eventProps.userId) {
    analyticsBrowser.identify(eventProps.userId, eventProps);
  } else {
    analyticsBrowser.identify(eventProps); // anonymous identify (email only)
  }
}

export function browserPageEvent(eventProps: { language: "en" | "fr" }) {
  analyticsBrowser.page(undefined, undefined, eventProps);
}
```

**Session utils (if needed):**

- `getOrCreateSessionId()` - UUID + sessionStorage
- `getOrCreateStartTime()` - Track duration
- `incrementErrorCount()` - Aggregate errors
- `clearAllTrackingData()` - Cleanup

#### B. Add Tracking Calls

**Pattern examples:**

```tsx
// Imports needed (for track/identify calls, not page - see root.tsx for page setup)
import { useEffect, useRef } from "react";
import { browserTrackEvent, browserIdentifyEvent } from "~/lib/analytics/events.defaults.client";

// Page load
useEffect(() => {
  browserTrackEvent("Event Name", { ... });
}, [deps]);

// ⚠️ REVIEW: useEffect with empty deps []
// If doing: useEffect(() => browserTrackEvent(...), [])
// Question: Is this just "page viewed"? If yes, page() event already captures it.
// Could be legitimate (one-time init, feature flag check), but analyze if redundant.

// Action success/error
const { submit } = useAction(def, {
  onSuccess: () => browserTrackEvent("Success", { ... }),
  onError: () => browserTrackEvent("Error", { ... }),
});

// User action
const handleClick = () => {
  browserTrackEvent("Action", { ... });
  existingLogic();
};

// Identify user (triggers: login, register, newsletter, profile update)
// CRITICAL: userId auto-attaches to all future events for attribution
const hasIdentifiedRef = useRef(false); // ← use ref to prevent duplicates

useEffect(() => {
  if (hasIdentifiedRef.current) return; // ← check ref first
  if (!user) return;

  browserIdentifyEvent({
    userId: user.id,
    email: user.email,
    fullName: user.display_name,
    firstName: user.first_name,
    lastName: user.last_name,
  });
  hasIdentifiedRef.current = true; // ← set ref
}, [user]);

// Page views (see root.tsx pattern above for debounced setup)
// Use browserPageEvent(), NOT track("Page Viewed")
```

**Surgical only:**

- Add imports
- Add tracking calls
- Don't touch component structure/logic/UI

---

### Phase 4: Verify

```bash
bun run typecheck
```

**Checklist:**

- [ ] All events typed correctly
- [ ] All tracking calls match definitions
- [ ] No type errors
- [ ] Minimal changes only
- [ ] Existing functionality preserved
- [ ] Review useEffect track calls with empty deps [] - might be redundant with page() events

---

## Output

```markdown
## Implementation Complete

**Summary:**

- App: [type]
- Scope: [scope]
- Events: [count]

**Events:**

1. **[Event]** - Fires: [where] - File: `path:line` - Value: [metric]
2. **[Event]** - Fires: [where] - File: `path:line` - Value: [metric]

**Files:**

- Created: `/app/lib/analytics/events.defaults.client.ts`
- Modified: `/app/routes/x.tsx:45` - Added "Event"

**Type Check:** [output]

**Testing:**

1. Console: `analytics.debug(true)`
2. Trigger: [how to test each event]

**Next:** Test → Debugger → Dashboards

**Business Impact:** Enables tracking [metrics]
```

---

## App Type Patterns

**Forms:** Track Started, Page Completed, Submitted, Submission Errored. Avoid field changes.

**E-commerce:** Track Product Viewed, Cart actions, Checkout steps, Order Completed, Payment Failed.

**SaaS:** Track Sign Up, Onboarding steps, Feature usage, Subscription changes.

**Marketing:** Track CTA Clicked, Lead Captured. UTMs auto-captured on all events.

---

## Stack

- React 19, React Router 7
- **@segment/analytics-next** - Client SDK (auto-captures UTMs, page props, device, anonymousId)
- **@segment/analytics-node** - Server SDK (placeholder - rarely used)
- Segment via Silo CDN
- TypeScript strict
- sessionStorage for persistence

**Conventions:**

- `/app/lib/analytics/events.defaults.client.ts`
- `/app/lib/analytics/session-utils.ts`

**Key: analytics-next auto-captures** UTMs, page properties, device/browser, anonymousId, IP. Don't manually add.

---

**User Input:** $1 (app-type), $2 (tracking-scope)

**Begin:** Discover → Recommend → Wait for approval → Implement → Verify
