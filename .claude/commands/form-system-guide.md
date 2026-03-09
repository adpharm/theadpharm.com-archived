# AI Agent Guide: Implementing Forms with Type-Safe Config System

**Version:** 2.0 (Condensed)
**Purpose:** Reference for AI agents implementing forms from copy decks using the type-safe form configuration system.

---

## 🤖 Claude Code Slash Command Instructions

**This guide covers THREE use cases:**

### Use Case 1: Implementing a New Form from Copy Deck

**When user provides a copy deck (Word doc, PDF, text):**

1. **Acknowledge** and confirm you've loaded this guide
2. **Ask for copy deck** if not provided
3. **Follow Implementation Workflow (Phase 1-6)** below
4. **Ask clarifying questions** during analysis before proceeding
5. **Present a plan** and get approval
6. **Implement systematically**: Enums → config → fields → conditionals → validate
7. **Run `bun run typecheck`** and report results

### Use Case 2: Adding/Editing Individual Fields

**When user wants to add, edit, or remove specific fields:**

1. **Identify target form** - Ask which form config file to modify
2. **Understand the change**:
   - Adding field? → Determine field type, label (EN/FR), schema, dependencies
   - Editing field? → Read existing config, understand what to change
   - Removing field? → Check for dependencies from other fields
3. **Present plan** - Show what will change
4. **Implement** - Make surgical edits to the config file
5. **Run `bun run typecheck`** and report results

### Use Case 3: Refactoring Form Structure

**When user wants to restructure (e.g., group fields into objects, split pages, rename keys):**

1. **Read existing form config** to understand current structure
2. **Clarify refactor goals** - What's the desired structure?
3. **Identify impacts**:
   - Database migration needed? (if changing field keys)
   - Dependencies need updating? (if renaming fields)
   - Existing responses affected? (if restructuring data shape)
4. **Present plan with warnings** about breaking changes
5. **Get explicit approval** for any breaking changes
6. **Implement refactor**
7. **Run `bun run typecheck`** and report results

---

**CRITICAL RULES (All Use Cases):**

- ❌ Never skip analysis or make assumptions about field types
- ❌ Never implement before presenting a plan
- ❌ Never forget bilingual labels (every user-facing string needs `l()`)
- ❌ Never create nested objects inside objects
- ❌ Never forget both `hide` AND `require` dependencies for conditional fields
- ❌ Never use short dependency paths in object properties (must be fully qualified: `parentKey.childKey`)
- ❌ Never change field keys without warning about database migration

**Output Format:**

- Concise and clear
- Show code diffs when editing existing files
- Report completion status and type-check results

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Implementation Workflow](#implementation-workflow)
3. [Field Type Reference](#field-type-reference)
4. [Conditional Logic System](#conditional-logic-system)
5. [Bilingual Implementation](#bilingual-implementation)
6. [Validation Patterns](#validation-patterns)
7. [Common Form Patterns](#common-form-patterns)
8. [Type Safety Requirements](#type-safety-requirements)
9. [Troubleshooting](#troubleshooting)

---

## System Overview

**Config-driven, type-safe form framework:**

- TypeScript config = single source of truth → Auto-generates Zod schemas, React components, JSONB database structure
- Conditional logic system for show/hide/require behavior
- Built-in bilingual support via `l()` function

**Critical Rule**: Define fields in config only. Do NOT manually write components, validation, or database schemas.

---

## Implementation Workflow

### Phase 1: Analysis

1. Read entire copy deck
2. Map questions to field types (see [Field Type Reference](#field-type-reference))
3. Identify conditional logic ("If yes, explain...")
4. Note required vs optional fields
5. Extract bilingual text
6. Group related questions (use `object` type)

### Phase 2: Enum Creation

Create enums in `/app/lib/form/data/form-data-enums.ts`:

```typescript
export const treatmentTypesEnum = ["Surgery", "Radiation", "Chemotherapy"] as const;

export const mapToTreatmentTypesEnumLabels = (key: string, l: I18NFunction) => {
  const map: Record<(typeof treatmentTypesEnum)[number], string> = {
    Surgery: l("Surgery", "Chirurgie"),
    Radiation: l("Radiation Therapy", "Radiothérapie"),
    Chemotherapy: l("Chemotherapy", "Chimiothérapie"),
  };
  return map[key as (typeof treatmentTypesEnum)[number]] ?? l("Unknown", "Inconnu");
};
```

**Enum Rules**:

- Always use `as const`
- Use PascalCase/snake_case (NO spaces)
- Provide EN/FR translations in mapper

### Phase 3: Form Config Creation

```typescript
import { z } from "zod";
import type { FormConfigInPages, I18NFunction } from "../form-config-types";
import { yesNoEnum, mapToYesNoEnumLabels } from "./form-data-enums";
import { enumError, arrayError, requiredError } from "./form-data-utils";

const yourFormConfigInPages = (l: I18NFunction): FormConfigInPages => [
  {
    pageTitle: l("Page Title", "Titre de la page"),
    pageDescription: l("Description", "Description"),
    formFields: {
      // Add fields here
    },
  },
];

export default yourFormConfigInPages;
```

### Phase 4: Implement Fields

For each question:

1. Choose field type
2. Create camelCase field key
3. Define: `type`, `label` (with `l()`), `schema`, optional properties
4. Add `dependencies` if conditional

**Example**:

```typescript
treatmentApproach: {
  type: "textarea",
  label: l("Describe your treatment approach", "Décrivez votre approche thérapeutique"),
  placeholder: l("Enter details...", "Entrez les détails..."),
  schema: z.string().min(1, { message: l("Required", "Requis") })
}
```

### Phase 5: Add Conditional Logic

```typescript
hasComplications: {
  type: "radioGroup",
  label: l("Were there complications?", "Y a-t-il eu des complications?"),
  schema: z.enum(yesNoEnum, { error: enumError(l) }),
  mapToLabels: mapToYesNoEnumLabels,
  cols: 2,
},
complicationDetails: {
  type: "textarea",
  label: l("Describe complications", "Décrire les complications"),
  schema: z.string().nullish(),
  dependencies: [
    { if: ["hasComplications", "not-equals", "Yes"], then: "hide" },
    { if: ["hasComplications", "equals", "Yes"], then: "require" },
  ],
}
```

### Phase 6: Validation

✅ Run `bun run typecheck`
✅ Verify bilingual labels
✅ Check enum imports
✅ Test dependencies

---

## Field Type Reference

### Quick Reference Table

| Type             | Use Case                             | Schema Type               | Key Props                                         |
| ---------------- | ------------------------------------ | ------------------------- | ------------------------------------------------- |
| `text`           | Short text (ID, name)                | `z.ZodString`             | `placeholder`, `description`                      |
| `textarea`       | Long text (explanations)             | `z.ZodString`             | `offerNotApplicable`                              |
| `radioGroup`     | Single choice from options           | `z.ZodEnum`               | `mapToLabels`, `cols`                             |
| `checkboxGroup`  | Multiple choices                     | `z.ZodArray<z.ZodEnum>`   | `mapToLabels`                                     |
| `singleCheckbox` | Boolean                              | `z.ZodBoolean`            | -                                                 |
| `switch`         | Boolean toggle                       | `z.ZodBoolean`            | `defaultValue`                                    |
| `hidden`         | Hidden data                          | `z.ZodString`             | -                                                 |
| `markdown`       | Display only                         | Optional                  | -                                                 |
| `ranking`        | Drag-to-order                        | `z.ZodArray<z.ZodString>` | `items`                                           |
| `rating-matrix`  | Multi-item scales (matrix with rows) | Auto-generated            | `scales`, `items`                                 |
| `object`         | Grouped fields                       | N/A (nested schemas)      | `properties`, `offerNotApplicableForEntireObject` |

### Decision Tree

```
Display-only? → markdown
Short text? → text
Long text? → textarea
Single choice (categorical OR single-item scale)? → radioGroup
Multiple choices? → checkboxGroup
Boolean? → switch or singleCheckbox
Drag-to-order? → ranking
Multiple items rated on scale(s) (matrix with row labels)? → rating-matrix
Group fields? → object
Hidden data? → hidden
```

**⚠️ CRITICAL: "Likert Scale" in Copy Decks - radioGroup vs rating-matrix**

Copy decks often label questions as `[Likert scale]`. This does NOT always mean `rating-matrix`. Look at the **structure**:

| Copy Deck Pattern                        | Field Type      | Example                                |
| ---------------------------------------- | --------------- | -------------------------------------- |
| Single question, pick 1-5 (no row items) | `radioGroup`    | "How confident are you? 1-5"           |
| Multiple items, each rated on scale(s)   | `rating-matrix` | Table with row labels rated on columns |

**Single-item scale → `radioGroup`:**

```
Q: How confident are you in X? [Likert scale]
| 1 (Not confident) | 2 | 3 | 4 | 5 (Very confident) |
```

This is just "pick one of 5 options" → use `radioGroup`

**Multi-item matrix → `rating-matrix`:**

```
|                     | Knowledge | Desire to learn |
| Topic A             | 1 2 3 4 5 | 1 2 3 4 5       |
| Topic B             | 1 2 3 4 5 | 1 2 3 4 5       |
```

This has row items being rated → use `rating-matrix`

### Key Field Types (Detailed)

#### `radioGroup` - Single Selection

Use for categorical choices AND single-item numeric scales (1-5 ratings without row labels).

```typescript
diseaseStage: {
  type: "radioGroup",
  label: l("Disease Stage", "Stade de la maladie"),
  schema: z.enum(diseaseStageEnum, { error: enumError(l) }),
  mapToLabels: mapToDiseaseStageEnumLabels,
  cols: 2,  // 2-column layout
}
```

**`cols` Property - Layout Guidance:**

| Label Length                         | Recommended `cols`     | Example                       |
| ------------------------------------ | ---------------------- | ----------------------------- |
| 1-2 characters (e.g., "1", "5", "A") | `cols: 5`              | Numeric-only scales           |
| Short words (e.g., "Yes", "No")      | `cols: 2` to `cols: 4` | Yes/No, Short categories      |
| Medium phrases                       | `cols: 2`              | Provinces, practitioner types |
| Long text (full sentences)           | `cols: 1` (default)    | Detailed options              |

**Single-item scale example (longer labels → no cols / cols: 1):**

```typescript
confidenceLevel: {
  type: "radioGroup",
  label: l("How confident are you in X?", "..."),
  options: confidenceEnum,  // ["1", "2", "3", "4", "5"]
  mapToLabels: (key, l) => ({
    "1": l("1 - Not confident", "1 - Pas confiant"),
    "2": l("2 - Slightly confident", "2 - Légèrement confiant"),
    "3": l("3 - Somewhat confident", "3 - Assez confiant"),
    "4": l("4 - Confident", "4 - Confiant"),
    "5": l("5 - Very confident", "5 - Très confiant"),
  }[key] ?? key),
  schema: z.enum(confidenceEnum, { error: enumError(l) }),
  // No cols specified = vertical list (appropriate for longer labels)
}
```

**Common Enums Available**: `yesNoEnum`, `standardPercentageEnum`

#### `checkboxGroup` - Multiple Selections

```typescript
treatmentModalities: {
  type: "checkboxGroup",
  label: l("Select modalities (all that apply)", "Sélectionner modalités (toutes applicables)"),
  schema: z.array(z.enum(modalitiesEnum), { error: arrayError(l) })
    .min(1, { message: l("Select at least one", "Sélectionner au moins un") }),
  mapToLabels: mapToModalitiesEnumLabels
}
```

**Data stored**: `["Surgery", "Radiation", "Chemotherapy"]`

#### `object` - Nested Fields (CRITICAL)

**Use for**: Grouping related fields, parent-child relationships, group N/A

**Rules**:

1. Nested fields: `text`, `textarea`, `radioGroup`, `checkboxGroup`, `switch`, `singleCheckbox`, `hidden`, `markdown`, `ranking` ONLY
2. NO nested objects inside objects
3. Dependency paths use dot notation: `parentObject.childField`
4. All nested fields inherit N/A with `offerNotApplicableForEntireObject: true`

**Basic Example**:

```typescript
patientDemographics: {
  type: "object",
  label: l("Patient Demographics", "Données démographiques du patient"),
  properties: {
    age: {
      type: "text",
      label: l("Age", "Âge"),
      schema: z.string().regex(/^\d+$/, { message: l("Must be a number", "Doit être un nombre") })
    },
    gender: {
      type: "radioGroup",
      label: l("Gender", "Sexe"),
      schema: z.enum(genderEnum, { error: enumError(l) }),
      mapToLabels: mapToGenderEnumLabels
    }
  }
}
```

**With Conditional Logic** (see [Pattern 1](#pattern-1-yesno-with-conditional-follow-up) for complete example):

```typescript
myObject: {
  type: "object",
  label: "",
  properties: {
    selection: { /* field 1 */ },
    conditionalField: {
      type: "textarea",
      schema: z.string().nullish(),
      dependencies: [
        { if: ["myObject.selection", "equals", "SomeValue"], then: "require" },
        { if: ["myObject.selection", "not-equals", "SomeValue"], then: "hide" }
      ]
    }
  }
}
```

**With Group N/A**:

```typescript
followUpProtocol: {
  type: "object",
  label: l("Follow-up Protocol", "Protocole de suivi"),
  offerNotApplicableForEntireObject: true,  // Single N/A for all
  properties: {
    frequency: {
      type: "textarea",
      label: l("How often?", "À quelle fréquence?"),
      schema: z.string().min(1, { message: l("Required", "Requis") })
        .or(z.literal("not_applicable")),
      hideNotApplicableCheckbox: true
    },
    methods: {
      type: "checkboxGroup",
      label: l("Methods used", "Méthodes utilisées"),
      schema: z.array(z.enum(methodsEnum), { error: arrayError(l) })
        .or(z.literal("not_applicable")),
      mapToLabels: mapToMethodsEnumLabels,
      hideNotApplicableCheckbox: true
    }
  }
}
```

When user checks N/A, all fields become `"not_applicable"`.

#### `ranking` - Drag-and-Drop

```typescript
priorityRanking: {
  type: "ranking",
  label: l("Rank by priority (drag to reorder)", "Classer par priorité (glisser)"),
  items: [
    { key: "cost", label: l("Cost", "Coût") },
    { key: "efficacy", label: l("Efficacy", "Efficacité") },
    { key: "safety", label: l("Safety", "Sécurité") }
  ],
  schema: z.array(z.string(), { error: rankingError(l) }).length(3, {
    message: l("Please rank all items", "Veuillez classer tous les éléments")
  })
}
```

**Data stored**: `["efficacy", "safety", "cost"]`

#### `rating-matrix` - Multi-Item Scale Ratings

**Use for**: Rating **multiple items** (rows) on one or more scales (columns). Creates a matrix/grid UI.

**⚠️ NOT for single-item scales** - use `radioGroup` instead (see Decision Tree above).

**Key Features**:

1. Rows = items to rate (must have row labels)
2. Columns = scales
3. Each item rated on each scale independently
4. Schema auto-generated from `items` and `scales` if not provided

**Structure**:

```typescript
type RatingMatrixScale = {
  key: string; // Used in data shape, e.g., "knowledge"
  label: string; // Column header
  options: { value: number | string; label?: string }[]; // First/last labels shown as endpoints
};

type RatingMatrixItem = {
  key: string; // Used in data shape, e.g., "topic_a"
  label: string; // Row label (required - this is what makes it a matrix!)
};
```

**Example (Multi-Item, Single Scale)**:

```typescript
satisfactionRatings: {
  type: "rating-matrix",
  label: l("Rate your satisfaction", "Évaluez votre satisfaction"),
  scales: [
    {
      key: "satisfaction",
      label: l("Satisfaction", "Satisfaction"),
      options: [
        { value: 1, label: l("Very Dissatisfied", "Très insatisfait") },
        { value: 2 },
        { value: 3 },
        { value: 4 },
        { value: 5, label: l("Very Satisfied", "Très satisfait") },
      ],
    },
  ],
  items: [
    { key: "support", label: l("Customer Support", "Service à la clientèle") },
    { key: "quality", label: l("Product Quality", "Qualité du produit") },
    { key: "delivery", label: l("Delivery Speed", "Rapidité de livraison") },
  ],
  // schema auto-generated
}
```

**Data stored**: `{ support: { satisfaction: 4 }, quality: { satisfaction: 5 }, delivery: { satisfaction: 3 } }`

**Multi-Scale Example (Knowledge + Desire)**:

```typescript
topicRatings: {
  type: "rating-matrix",
  label: l("Knowledge Assessment", "Évaluation des connaissances"),
  description: l(
    "Rate your knowledge and desire to learn for each topic.",
    "Évaluez vos connaissances et votre désir d'apprendre pour chaque sujet."
  ),
  scales: [
    {
      key: "knowledge",
      label: l("Current level of knowledge", "Niveau actuel de connaissances"),
      options: [
        { value: 1, label: l("No knowledge", "Aucune connaissance") },
        { value: 2, label: l("Limited", "Limité") },
        { value: 3, label: l("Some", "Quelques") },
        { value: 4, label: l("Good", "Bonnes") },
        { value: 5, label: l("Expert", "Expert") },
      ],
    },
    {
      key: "desire",
      label: l("Desire to learn more", "Désir d'en apprendre plus"),
      options: [
        { value: 1, label: l("Low", "Bas") },
        { value: 2 },
        { value: 3 },
        { value: 4 },
        { value: 5, label: l("High", "Élevé") },
      ],
    },
  ],
  items: [
    { key: "web_dev", label: l("Web Development", "Développement web") },
    { key: "data_science", label: l("Data Science", "Science des données") },
    { key: "ai_ml", label: l("AI / Machine Learning", "IA / Apprentissage automatique") },
  ],
}
```

**Data stored**: `{ web_dev: { knowledge: 3, desire: 5 }, data_science: { knowledge: 2, desire: 4 }, ai_ml: { knowledge: 1, desire: 5 } }`

**Auto-Generated Schema**:

```typescript
// Schema is auto-generated as:
z.object({
  [item.key]: z.object({
    [scale.key]: z.number({ message: "Required" }),
    // ... for each scale
  }),
  // ... for each item
});
```

**Rules**:

- Use descriptive `key` values (snake_case)
- Provide endpoint labels for scale options (first/last at minimum)
- All items must be rated on all scales (required by default)
- Can be used inside `object` type

---

## Conditional Logic System

### Structure

```typescript
type Dependencies = {
  if: [fieldPath, operator, value]; // PRIMARY (required)
  or?: [fieldPath, operator, value]; // OR conditions
  or2?: [fieldPath, operator, value];
  and?: [fieldPath, operator, value]; // AND conditions
  and2?: [fieldPath, operator, value];
  then: "hide" | "require";
};
```

**Evaluation**: `(if OR or OR or2) AND and AND and2 → then`

### Operators

| Operator                        | Use Case                        | Example                                                 |
| ------------------------------- | ------------------------------- | ------------------------------------------------------- |
| `equals`                        | Radio values, booleans, strings | `["status", "equals", "Completed"]`                     |
| `not-equals`                    | Inverse, "hide unless X"        | `["hasSymptoms", "not-equals", "Yes"]`                  |
| `contains-case-insensitive`     | Checkbox arrays, string search  | `["options", "contains-case-insensitive", "Other"]`     |
| `not-contains-case-insensitive` | NOT contains                    | `["types", "not-contains-case-insensitive", "Surgery"]` |

### Common Patterns

**Nested Object Dependencies** (use dot notation):

**⚠️ CRITICAL: Full Path Required for Object Properties**

When defining dependencies for fields inside an `object` type, you **MUST** use the fully qualified path: `{questionKey}.{propertyName}`.

❌ **WRONG** - Using just the property name:

```typescript
national_consensus_pathway_focus: {
  type: "object",
  properties: {
    focus: { /* checkboxGroup */ },
    other: {
      type: "textarea",
      dependencies: [
        // ❌ WRONG - just "focus" without parent key
        { if: ["focus", "contains-case-insensitive", "other"], then: "require" }
      ]
    }
  }
}
```

✅ **CORRECT** - Using full path with questionKey:

```typescript
national_consensus_pathway_focus: {
  type: "object",
  properties: {
    selection: { /* checkboxGroup */ },
    other_specify: {
      type: "textarea",
      dependencies: [
        // ✅ CORRECT - full path: "national_consensus_pathway_focus.selection"
        { if: ["national_consensus_pathway_focus.selection", "contains-case-insensitive", "other"], then: "require" }
      ]
    }
  }
}
```

**Why?** The form data structure has the questionKey as the parent object:

```json
{
  "national_consensus_pathway_focus": {
    "selection": ["value1", "value2"],
    "other_specify": "text here"
  }
}
```

The dependency system needs the complete path to correctly evaluate conditions.

**More Examples:**

```typescript
treatment: {
  type: "object",
  properties: {
    type: { /* radioGroup */ },
    surgeryDetails: {
      type: "textarea",
      schema: z.string().nullish(),
      dependencies: [
        { if: ["treatment.type", "not-equals", "Surgery"], then: "hide" },
        { if: ["treatment.type", "equals", "Surgery"], then: "require" }
      ]
    }
  }
}
```

**OR Logic**:

```typescript
explanation: {
  type: "textarea",
  schema: z.string().nullish(),
  dependencies: [{
    if: ["status", "equals", "Complicated"],
    or: ["status", "equals", "Failed"],
    or2: ["status", "equals", "Discontinued"],
    then: "require"  // Require if ANY match
  }]
}
```

**AND Logic**:

```typescript
detailedAnalysis: {
  type: "textarea",
  schema: z.string().nullish(),
  dependencies: [{
    if: ["isCompleted", "equals", true],
    and: ["hasData", "equals", true],
    and2: ["isVerified", "equals", true],
    then: "require"  // Require if ALL true
  }]
}
```

**Handle Empty/Null**:

```typescript
followUp: {
  type: "textarea",
  schema: z.string().nullish(),
  dependencies: [{
    if: ["percentageField", "equals", "0"],
    or: ["percentageField", "equals", null],
    or2: ["percentageField", "equals", undefined],
    then: "hide"
  }]
}
```

### Debugging Checklist

1. ✅ Dependencies use full dot notation: `parentObject.childField` (not just `childField`)
2. ✅ `contains-case-insensitive` for arrays, `equals` for strings
3. ✅ Include BOTH `hide` AND `require` dependencies
4. ✅ Controlling field exists and is defined first
5. ✅ Schema uses `.nullish()` for hideable fields

---

## Bilingual Implementation

### `l()` Function

```typescript
type I18NFunction = (en: string, fr: string) => string;
```

**✅ ALWAYS use for**: Labels, placeholders, descriptions, help text, validation messages, enum mappers, page titles, markdown
**❌ NEVER use for**: Field keys, enum values, dependency paths

### Examples

**Validation Messages**:

```typescript
// Required
schema: z.string().min(1, { message: l("This field is required", "Ce champ est requis") });

// Email
schema: z.string().email({ message: l("Invalid email", "Courriel invalide") });

// Custom
schema: z.string().refine((val) => val.startsWith("PREFIX-"), {
  message: l("Must start with PREFIX-", "Doit commencer par PREFIX-"),
});
```

**Enum Mapping**:

```typescript
// 1. Define enum
export const diseaseStageEnum = ["Stage_I", "Stage_II", "Stage_III", "Stage_IV"] as const;

// 2. Define mapper
export const mapToDiseaseStageEnumLabels = (key: string, l: I18NFunction) => {
  const map: Record<(typeof diseaseStageEnum)[number], string> = {
    Stage_I: l("Stage I", "Stade I"),
    Stage_II: l("Stage II", "Stade II"),
    Stage_III: l("Stage III", "Stade III"),
    Stage_IV: l("Stage IV", "Stade IV"),
  };
  return map[key as (typeof diseaseStageEnum)[number]] ?? l("Unknown", "Inconnu");
};

// 3. Use in config
diseaseStage: {
  type: "radioGroup",
  label: l("Disease Stage", "Stade de la maladie"),
  schema: z.enum(diseaseStageEnum, { error: enumError(l) }),
  mapToLabels: mapToDiseaseStageEnumLabels
}
```

**Best Practices**:

- Keep labels short, use `description` for details
- Consistent terminology across form
- `placeholder` shows example, `label` shows field purpose

---

## Validation Patterns

### Schema Reference

| Pattern          | Schema                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Required string  | `z.string().min(1, { message: l("Required", "Requis") })`                                |
| Optional string  | `z.string().nullish()`                                                                   |
| String with N/A  | `z.string().min(1).or(z.literal("not_applicable"))`                                      |
| Email            | `z.string().email({ message: l("Invalid email", "Invalide") })`                          |
| URL              | `z.string().url({ message: l("Invalid URL", "URL invalide") })`                          |
| Regex            | `z.string().regex(/pattern/, { message: l("Format: X", "Format : X") })`                 |
| Number (string)  | `z.string().regex(/^\d+$/, { message: l("Must be number", "Doit être nombre") })`        |
| Required enum    | `z.enum(myEnum, { error: enumError(l) })`                                                |
| Optional enum    | `z.enum(myEnum, { error: enumError(l) }).nullish()`                                      |
| Required array   | `z.array(z.enum(myEnum), { error: arrayError(l) }).min(1)`                               |
| Optional array   | `z.array(z.enum(myEnum), { error: arrayError(l) }).optional()`                           |
| Ranking          | `z.array(z.string(), { error: rankingError(l) }).length(N)`                              |
| Required boolean | `z.boolean().refine(val => val === true, { message: l("Must agree", "Doit accepter") })` |
| Optional boolean | `z.boolean().optional()`                                                                 |

### Error Helpers

```typescript
import { enumError, arrayError, requiredError, rankingError } from "./form-data-utils";

// For radioGroup
schema: z.enum(yesNoEnum, { error: enumError(l) });
// Provides: "Please select an option" / "Veuillez sélectionner une option"

// For checkboxGroup
schema: z.array(z.enum(treatmentEnum), { error: arrayError(l) });
// Provides: "Please select at least one option" / "Veuillez sélectionner au moins une option"

// For required string
schema: z.string().min(1, { error: requiredError(l) });
// Provides: "This field is required" / "Ce champ est requis"

// For ranking
schema: z.array(z.string(), { error: rankingError(l) }).length(N, { message: l("...", "...") });
// Provides: "Please rank all items" / "Veuillez classer tous les éléments"
```

---

## Common Form Patterns

### Pattern 1: Yes/No with Conditional Follow-up

**Copy Deck**:

```
Q1: Were there complications?
  ○ Yes / ○ No
Q2: If yes, describe.
```

**Implementation**:

```typescript
complications: {
  type: "object",
  label: "",
  properties: {
    occurred: {
      type: "radioGroup",
      label: l("Were there complications?", "Y a-t-il eu des complications?"),
      schema: z.enum(yesNoEnum, { error: enumError(l) }),
      mapToLabels: mapToYesNoEnumLabels,
      cols: 2
    },
    description: {
      type: "textarea",
      label: l("If yes, describe", "Si oui, décrire"),
      schema: z.string().nullish(),
      dependencies: [
        { if: ["complications.occurred", "not-equals", "Yes"], then: "hide" },
        { if: ["complications.occurred", "equals", "Yes"], then: "require" }
      ]
    }
  }
}
```

### Pattern 2: Checkbox with "Other (specify)"

**Copy Deck**:

```
Q: Which treatments? (Select all)
  □ Surgery
  □ Radiation
  □ Other: _______
```

**Implementation**:

```typescript
// 1. Define enum
export const treatmentModalitiesEnum = ["Surgery", "Radiation", "Other"] as const;
export const mapToTreatmentModalitiesEnumLabels = (key: string, l: I18NFunction) => {
  const map: Record<(typeof treatmentModalitiesEnum)[number], string> = {
    Surgery: l("Surgery", "Chirurgie"),
    Radiation: l("Radiation", "Radiothérapie"),
    Other: l("Other", "Autre"),
  };
  return map[key as (typeof treatmentModalitiesEnum)[number]] ?? l("Unknown", "Inconnu");
};

// 2. Implement
treatmentModalities: {
  type: "object",
  label: "",
  properties: {
    selected: {
      type: "checkboxGroup",
      label: l("Which treatments? (Select all)", "Quels traitements? (Sélectionner tous)"),
      schema: z.array(z.enum(treatmentModalitiesEnum), { error: arrayError(l) })
        .min(1, { message: l("Select at least one", "Sélectionner au moins un") }),
      mapToLabels: mapToTreatmentModalitiesEnumLabels
    },
    otherSpecify: {
      type: "textarea",
      label: l("Other (please specify)", "Autre (veuillez préciser)"),
      schema: z.string().nullish(),
      dependencies: [
        { if: ["treatmentModalities.selected", "not-contains-case-insensitive", "Other"], then: "hide" },
        { if: ["treatmentModalities.selected", "contains-case-insensitive", "Other"], then: "require" }
      ]
    }
  }
}
```

### Pattern 3: Multi-Level Conditional

**Copy Deck**:

```
Q1: Have a multidisciplinary team?
  ○ Yes / ○ No
Q2: If yes, who? (Select all)
  □ Oncologist
  □ Surgeon
  □ Other
Q3: If "Other", specify: _______
```

**Implementation**:

```typescript
mdtDiscussion: {
  type: "object",
  label: "",
  properties: {
    hasMdt: {
      type: "radioGroup",
      label: l("Have multidisciplinary team?", "Équipe multidisciplinaire?"),
      schema: z.enum(yesNoEnum, { error: enumError(l) }),
      mapToLabels: mapToYesNoEnumLabels,
      cols: 2
    },
    whoIsInvolved: {
      type: "checkboxGroup",
      label: l("If yes, who? (Select all)", "Si oui, qui? (Sélectionner tous)"),
      schema: z.array(z.enum(mdtMembersEnum), { error: arrayError(l) }).nullish(),
      mapToLabels: mapToMdtMembersEnumLabels,
      dependencies: [
        { if: ["mdtDiscussion.hasMdt", "not-equals", "Yes"], then: "hide" },
        { if: ["mdtDiscussion.hasMdt", "equals", "Yes"], then: "require" }
      ]
    },
    otherSpecify: {
      type: "textarea",
      label: l("If 'Other', specify", "Si 'Autre', préciser"),
      schema: z.string().nullish(),
      dependencies: [
        { if: ["mdtDiscussion.hasMdt", "not-equals", "Yes"], then: "hide" },
        {
          if: ["mdtDiscussion.whoIsInvolved", "not-contains-case-insensitive", "Other"],
          and: ["mdtDiscussion.hasMdt", "equals", "Yes"],
          then: "hide"
        },
        {
          if: ["mdtDiscussion.whoIsInvolved", "contains-case-insensitive", "Other"],
          and: ["mdtDiscussion.hasMdt", "equals", "Yes"],
          then: "require"
        }
      ]
    }
  }
}
```

### Pattern 4: Ranking with "Other (specify)"

**Copy Deck**:

```
Q: Rank the following options from 1 (most feasible) to 4 (least feasible):
  - Option A
  - Option B
  - Option C
  - Other: _______
```

**Implementation**:

```typescript
feasibilityRanking: {
  type: "object",
  label: "",  // Empty label - ranking provides its own
  properties: {
    ranking: {
      type: "ranking",
      label: l(
        "Rank from 1 (most feasible) to 4 (least feasible):",
        "Classez de 1 (le plus réalisable) à 4 (le moins réalisable) :"
      ),
      items: [
        { key: "option_a", label: l("Option A", "Option A") },
        { key: "option_b", label: l("Option B", "Option B") },
        { key: "option_c", label: l("Option C", "Option C") },
        { key: "other", label: l("Other", "Autre") },  // lowercase key
      ],
      schema: z.array(z.string(), { error: rankingError(l) }).length(4, {
        message: l("Please rank all items", "Veuillez classer tous les éléments"),
      }),
    },
    otherSpecify: {
      type: "textarea",
      label: l("Please specify 'Other':", "Veuillez préciser 'Autre' :"),
      schema: z.string().nullish(),
      dependencies: [
        // Note: check against "ranking" not "feasibilityRanking.ranking" when inside same object
        { if: ["feasibilityRanking.ranking", "not-contains-case-insensitive", "other"], then: "hide" },
        { if: ["feasibilityRanking.ranking", "contains-case-insensitive", "other"], then: "require" },
      ],
    },
  },
}
```

**Key Points**:

- Wrap in `object` type with empty label
- "other" is one of the ranking items (use lowercase key)
- Use `contains-case-insensitive` to check if "other" is in the ranked array
- Both `hide` AND `require` dependencies required
- Dependency path uses full dot notation: `parentObject.ranking`

---

## Type Safety Requirements

### Critical Rules

1. **Enum `as const`**:

   ```typescript
   ✅ export const myEnum = ["A", "B", "C"] as const;
   ❌ export const myEnum = ["A", "B", "C"];
   ```

2. **Schema matches field type**:

   ```typescript
   ✅ { type: "text", schema: z.string() }
   ✅ { type: "radioGroup", schema: z.enum(someEnum) }
   ✅ { type: "checkboxGroup", schema: z.array(z.enum(someEnum)) }
   ❌ { type: "text", schema: z.number() }
   ❌ { type: "radioGroup", schema: z.string() }
   ```

3. **Object properties**: Only `text`, `textarea`, `radioGroup`, `checkboxGroup`, `switch`, `singleCheckbox`, `hidden`, `markdown`, `ranking`, `rating-matrix`. NO nested objects.

4. **Dependency paths**: Use dot notation

   ```typescript
   ✅ if: ["parentObject.childField", "equals", "value"]
   ❌ if: ["parentObject[childField]", "equals", "value"]
   ```

5. **Import error helpers**:
   ```typescript
   import { enumError, arrayError, requiredError } from "./form-data-utils";
   schema: z.enum(myEnum, { error: enumError(l) });
   schema: z.array(z.enum(myEnum), { error: arrayError(l) });
   ```

---

## Troubleshooting

### Common Errors

**Type mismatch**:

```typescript
❌ { type: "text", schema: z.number() }
✅ { type: "text", schema: z.string() }
```

**Missing mapToLabels**:

```typescript
❌ { type: "radioGroup", schema: z.enum(myEnum) }
✅ { type: "radioGroup", schema: z.enum(myEnum, { error: enumError(l) }), mapToLabels: mapToMyEnumLabels }
```

**Conditional logic not working**:

```typescript
❌ dependencies: [{ if: ["field", "not-equals", "Yes"], then: "hide" }]  // Missing "require"
✅ dependencies: [
  { if: ["field", "not-equals", "Yes"], then: "hide" },
  { if: ["field", "equals", "Yes"], then: "require" }
]
```

**Nested objects**:

```typescript
❌ { type: "object", properties: { child: { type: "object", ... } } }  // NO nesting
✅ { type: "object", properties: { field1: { type: "text", ... }, field2: { type: "textarea", ... } } }
```

**Wrong dependency path**:

```typescript
❌ if: ["treatment.type.value", "equals", "X"]  // Too deep
❌ if: ["treatment[type]", "equals", "X"]       // Wrong syntax
✅ if: ["treatment.type", "equals", "X"]
```

**N/A checkbox not appearing**:

```typescript
// Single field
✅ {
  type: "textarea",
  offerNotApplicable: true,
  schema: z.string().min(1).or(z.literal("not_applicable"))
}

// Object (all fields)
✅ {
  type: "object",
  offerNotApplicableForEntireObject: true,
  properties: {
    field1: {
      schema: z.string().min(1).or(z.literal("not_applicable")),
      hideNotApplicableCheckbox: true
    }
  }
}
```

### Best Practices Checklist

Before submitting:

- ✅ All field keys use camelCase
- ✅ All user-facing text uses `l()`
- ✅ All enums use `as const`
- ✅ All enum mappers created
- ✅ All schemas match field types
- ✅ All required fields have error messages
- ✅ All conditional fields have BOTH `hide` AND `require`
- ✅ All nested paths use dot notation (`parentKey.childKey`)
- ✅ No nested objects
- ✅ Correct imports (`enumError`, `arrayError`, `requiredError`)
- ✅ `bun run typecheck` passes
- ✅ All bilingual text provided

---

## Philosophy & Workflow

**System Philosophy**:

1. Config is truth - never manually write validation/components
2. Type safety first - let TypeScript catch errors at compile time
3. DRY principle - define once, use everywhere
4. Fail fast - required = required, no silent defaults
5. Bilingual by default - every user-facing string gets `l()`

**Quick Workflow**:

1. Read copy deck
2. Map questions to field types
3. Create enums (if needed)
4. Create form config file
5. Define pages and fields
6. Add conditional logic
7. Add bilingual labels
8. Run `bun run typecheck`
9. Test in UI

**Getting Help**:

1. Search existing form configs for patterns
2. Check `form-config-types.ts` for type definitions
3. Review `form-data-utils.ts` utilities
4. Inspect `form-config-to-form-components.tsx`, `form-config-to-zod-schema.tsx`

---

**End of Guide**
