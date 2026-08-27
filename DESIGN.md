---
name: Octomind
description: A calm student scheduling system that turns deadlines and homework into a usable week.
colors:
  background: "#fff8df"
  foreground: "#0d2e92"
  card: "#fffff7"
  primary: "#0d2e92"
  primary-foreground: "#fff8df"
  secondary: "#c0ecb8"
  muted: "#e8f6d9"
  muted-foreground: "#0f5d6d"
  border: "#9ed9ca"
  ring: "#4684e5"
  destructive: "oklch(0.577 0.245 27.325)"
  school: "oklch(0.925 0.057 198)"
  homework: "oklch(0.925 0.068 18)"
  studying: "oklch(0.93 0.064 313)"
  extracurriculars: "oklch(0.935 0.075 145)"
  work: "oklch(0.92 0.075 78)"
  other: "oklch(0.925 0.045 253)"
typography:
  display:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "4.5rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0"
  headline:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "0"
  title:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.55
    letterSpacing: "0"
  body:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "0"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
    typography: "{typography.label}"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
    typography: "{typography.label}"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
    typography: "{typography.body}"
  badge-default:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
    typography: "{typography.label}"
  calendar-event-homework:
    backgroundColor: "{colors.homework}"
    textColor: "{colors.background}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
    typography: "{typography.label}"
---

# Design System: Octomind

## 1. Overview

**Creative North Star: "Ocean Coast Study Flow"**

Octomind's authenticated interface is now an Ocean Coast product UI: `#fff8df` sand backgrounds, sea-green panels, deep-blue actions, teal accents, and coral-pastel task categories. The calendar should feel calm and bright for high school students who need to see class, homework, work, activities, and sleep constraints without fighting a heavy dashboard.

The authenticated product should stay task-first. Calendar, onboarding, and integrations screens should use familiar product patterns, modest density, explicit state, and standard controls. The logged-out homepage can carry more marketing energy, demos, and proof, but it still needs to look connected to the same scheduling product rather than a separate AI launch page.

This system rejects generic AI SaaS dashboard styling. No vague automation glow, no gradients, no enterprise calendar clutter, and no decorative complexity that makes homework planning feel harder than the homework.

**Key Characteristics:**
- Bright coastal product shell with `#fff8df` sand canvas, sea-green surfaces, deep-blue action states, and teal/blue supporting accents.
- Coral-reef pastel task categories spanning the rainbow, not only shades of blue.
- Small-radius controls, compact spacing, and practical shadcn/Radix affordances.
- Color used for primary actions, active states, task categories, and status only.
- Motion used for state changes and calendar transitions, not page-load theater.
- Clear status language around protected sleep, school time, sync health, and errors.

## 2. Colors

The current palette is a light Ocean Coast product system with coral-reef category accents for student scheduling context.

### Primary
- **Deep Coast Blue** (`primary`, `foreground`): The main action, selected-state, and text color. Use it for primary buttons, active badges, headings, and decisive controls because it keeps strong contrast on `#fff8df`.

### Secondary
- **Lagoon School** (`school`): A soft cyan class color for school-hours commitments.
- **Coral Homework** (`homework`): A warm reef pastel for homework blocks and related schedule cues.
- **Anemone Study** (`studying`): A soft violet study-session color, reserved for scheduled studying work.
- **Kelp Activity** (`extracurriculars`): A bright green non-class commitment color for activities and clubs.
- **Sunlit Work** (`work`): A yellow pastel job or time-constraint color with more urgency than green but less alarm than destructive red.
- **Shell Other** (`other`): A quiet periwinkle fallback for uncategorized tasks.

### Neutral
- **Sand Canvas** (`background`): `#fff8df` page background for logged-in product work.
- **Foam Surface** (`card`): Warm near-white panels and forms.
- **Sea Grass Surface** (`secondary`, based on `#c0ecb8`): Brighter toolbar and secondary fills.
- **Lagoon Accent** (`accent`, based on `#4abbbd`): Hover states and secondary emphasis, paired with deep-blue text.
- **Harbor Teal** (`#1e80a0`): Supporting accent for icons, drop targets, and charts; avoid using it for small text on sand.
- **Focus Blue** (`ring`, based on `#4684e5`): Accessible focus treatment through border shift and a 3px ring at 50% opacity.
- **Foam Line** (`border`): Thin separators, input borders, panel divisions, and calendar grid structure.
- **Action Red** (`destructive`): Destructive actions and true errors only.

### Named Rules

**The Reef Category Rule.** Event colors should read like coral reef pastels across the rainbow. Avoid category systems that collapse into only blue or teal.

**The Coastal Product Rule.** Coastal atmosphere belongs in shared surfaces, shadows, borders, and fills. The calendar remains a usable planning tool first.

**The No Gradients Rule.** Do not use gradients anywhere in the site UI. Ocean Coast should be expressed through flat sand, teal, sea-glass, and coral-pastel tokens.

## 3. Typography

**Display Font:** Geist Sans via `var(--font-geist-sans)` with `system-ui, sans-serif` fallback.
**Body Font:** Geist Sans via `var(--font-geist-sans)` with `system-ui, sans-serif` fallback.
**Label/Mono Font:** Geist Mono exists as `var(--font-geist-mono)` but should be reserved for technical data only.

**Character:** The type system is plainspoken and product-native. It uses one sans family across headings, labels, controls, and calendar data so students can scan quickly without a decorative typographic layer.

### Hierarchy
- **Display** (600, 4.5rem, 1 line-height): Logged-out homepage brand moment only. Keep letter spacing at `0`.
- **Headline** (600, 1.5rem, 1.33 line-height): Page headers such as "Set up your week", "Integrations", and compact authenticated page titles.
- **Title** (600, 1.125rem, 1.55 line-height): Section headings, integration card titles, and form group headings.
- **Body** (400, 0.875rem, 1.5 line-height): Supporting copy, descriptions, metadata, and calendar details. Longer prose should stay near 65-75ch.
- **Label** (500, 0.875rem, 1.25 line-height): Buttons, field labels, tab labels, badges, and compact control text.

### Named Rules

**The One-Family Rule.** Use Geist Sans for product UI. Do not introduce display fonts into labels, buttons, calendar cells, or settings surfaces.

**The No Tiny Eyebrow Rule.** Do not scaffold marketing sections with repeated uppercase tracked eyebrow labels. The homepage can use clear headings and demos without that pattern.

**The Literal Planning Label Rule.** Use literal labels for task-critical UI: Add Homework, Due date, Estimate time, Today's events. Keep Ocean Coast language out of buttons, form labels, errors, and planning-panel headings.

## 4. Elevation

Octomind uses a hybrid of thin borders and very small shadows. Surfaces are mostly flat at rest; depth comes from `border`, background contrast, and `shadow-sm`/`shadow-xs` on contained controls. This keeps the calendar and settings screens usable without making every item feel like a floating card.

### Shadow Vocabulary
- **Control Shadow** (`shadow-xs`): Used by shadcn buttons, outline buttons, and inputs for a slight tactile edge.
- **Panel Shadow** (`shadow-sm`): Used sparingly on major containers such as the calendar shell, onboarding form, and integration card.

### Named Rules

**The Flat Calendar Rule.** Calendar cells, rows, and dense schedule areas should rely on borders and fills first. Use shadows only for major containers or interactive lift.

**The No Ghost Card Rule.** Do not pair a decorative 1px border with wide soft shadows. If an element has a border, any shadow must stay subtle and functional.

## 5. Components

### Buttons
- **Shape:** Gently curved rectangle (`8px` radius, `36px` default height).
- **Primary:** Deep Coast Blue background with sand text, `8px 16px` padding, medium label weight, lucide icons at `16px`.
- **Hover / Focus:** Hover darkens through opacity (`primary/90`). Focus uses visible border shift plus a 3px ring from `ring/50`.
- **Secondary / Ghost / Tertiary:** Outline buttons use foam or sand backgrounds, lagoon borders, and subtle shadow. Ghost buttons remove chrome until hover and are best for navigation or low-risk actions.

### Chips
- **Style:** Badges use `8px` radius, thin borders, `2px 8px` padding, and `12px` text.
- **State:** Default badges carry primary status; outline badges carry neutral state such as loading or not connected. Destructive badges are reserved for actual attention states.

### Cards / Containers
- **Corner Style:** Major panels use `10px` radius, matching `rounded-lg`.
- **Background:** Warm foam panels on `#fff8df` sand page backgrounds.
- **Shadow Strategy:** Use `shadow-sm` for major panels only.
- **Border:** Thin lagoon border (`border`) is the primary container definition.
- **Internal Padding:** Compact product panels use `16px` on mobile and `20-24px` where the screen has room.

### Inputs / Fields
- **Style:** Transparent or white background with `border-input`, `8px` radius, `36px` height, and `12px` horizontal padding.
- **Focus:** Focus must be visible through `border-ring` and a 3px ring. Do not remove outlines without replacing them.
- **Error / Disabled:** Invalid controls use destructive border/ring treatment. Disabled controls reduce opacity and must not accept pointer events.

### Navigation
- **Style:** Top-level product navigation is compact: logo plus title on the left, auth or settings actions on the right. Tabs use a bordered pill-like list with active items on a white background and `shadow-sm`.
- **States:** Active calendar views expand to show the label; inactive views can collapse to icons only if the selected state remains clear.
- **Mobile Treatment:** Headers wrap vertically before squeezing controls. Full-width tab lists and stacked action buttons are acceptable on narrow screens.

### Calendar Event Blocks
- **Style:** Event blocks use `8px` radius, thin category-tinted borders, soft category fills, compact `12px` labels, and bold event titles.
- **State:** Category color must be paired with readable text and, in dot mode, a visible dot marker so color is not the only cue.
- **Behavior:** Event blocks are draggable/resizable affordances. Preserve focusability, clear cursor states, and enough hit area for touch.

## 6. Do's and Don'ts

### Do:
- **Do** keep the logged-in product task-first: calendar, tasks, school hours, sleep, sync status, and errors should be immediately legible.
- **Do** use brighter category colors to clarify homework, studying, school, extracurriculars, and work.
- **Do** preserve visible keyboard focus using the existing 3px ring vocabulary.
- **Do** use skeletons for loading states inside content areas.
- **Do** make the logged-out homepage more demonstrative and persuasive while keeping it visually connected to the product shell.

### Don't:
- **Don't** make Octomind feel like a generic AI SaaS dashboard.
- **Don't** use gradients, glowing abstract automation graphics, glass cards, or vague AI claims as the brand.
- **Don't** create heavy enterprise-calendar clutter; students should see the plan faster than they can explain the UI.
- **Don't** gamify planning in a way that distracts from homework, deadlines, and time saved.
- **Don't** rely on color alone for category or health status; pair color with text, icons, shape, or placement.
- **Don't** use repeated tiny uppercase eyebrows, numbered section scaffolds, side-stripe card accents, decorative grid backgrounds, or over-rounded cards.
