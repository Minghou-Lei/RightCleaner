# MIN-41 Visual Baseline

## Goal

Establish a modern, restrained visual system for RightCleaner with a calm interface,
high readability, consistent spacing, and lightweight motion.

## Design Principles

### 1. Clear Before Decorative
- Keep layouts airy and easy to scan.
- Prefer contrast, whitespace, and structure over heavy ornament.
- Use accent color to guide action, not to decorate every surface.

### 2. Calm and Modern
- Build around soft neutrals with one confident brand accent.
- Favor subtle depth and low-noise surfaces instead of glassmorphism or harsh shadows.
- Keep UI density medium: compact enough for productivity, never cramped.

### 3. Consistent Hierarchy
- Use typography scale and spacing scale as the primary hierarchy tools.
- Titles should feel deliberate; body text should stay neutral and highly legible.
- States should be predictable across all components.

### 4. Motion With Purpose
- Motion should clarify changes in state, focus, and navigation.
- Keep transitions short and smooth.
- Avoid bounce, overshoot, and distracting loops in product UI.

## Visual Direction

### Brand Tone
- Clean utility software
- Light, refined, trustworthy
- Slightly warm neutrals with a fresh teal-blue accent

### Color System
- Backgrounds rely on layered off-white and soft gray-blue neutrals.
- Primary actions use teal-blue for clarity and modernity.
- Success, warning, and danger use muted functional tones instead of saturated alerts.

### Typography
- Primary font: `Plus Jakarta Sans`, with `Inter` and system sans fallbacks.
- Headings should be moderately tight and confident.
- Body text should be open, neutral, and optimized for reading.
- Use semibold for emphasis before resorting to darker color blocks.

## Tokens

The canonical implementation lives in [styles/design-tokens.css](/C:/Users/admin/AppData/Local/Temp/vibe-kanban/worktrees/9705-workspace/RightCleaner/styles/design-tokens.css).

## Spacing Rules

- Base spacing unit: `4px`
- Standard layout rhythm: `8 / 12 / 16 / 24 / 32 / 48 / 64`
- Default page padding: `24px` on desktop, `16px` on mobile
- Section gaps should default to `32px` or `48px`
- Card padding should default to `20px` or `24px`

## Component Style Rules

### Surfaces
- Main page background should use the base background token.
- Cards and panels should use raised surfaces with soft borders.
- Avoid pure white unless a layer must clearly sit above another.

### Buttons
- Primary buttons are solid brand color with high contrast text.
- Secondary buttons are neutral surfaces with subtle border emphasis.
- Ghost buttons should only be used in low-emphasis contexts.
- All buttons use medium radius and quick hover/focus feedback.

### Inputs
- Inputs use quiet backgrounds and clear focus rings.
- Focus states should rely on ring plus border shift, not color fill alone.
- Placeholder text must remain visibly distinct from actual text.

### Data and Feedback
- Status colors should be readable on both light surfaces and tinted badges.
- Empty states should be simple and instructional, not playful.
- Destructive actions must be clearly separated from primary actions.

## Motion Principles

- Fast interactions: `120ms-180ms`
- Standard transitions: `180ms-240ms`
- Large layout or modal transitions: `240ms-320ms`
- Use `ease-out` for reveal, `ease-in-out` for state changes
- Respect `prefers-reduced-motion`

## Accessibility Baseline

- Text must maintain readable contrast against all surfaces.
- Focus must remain visible for keyboard users on every interactive element.
- Never communicate state with color alone.
- Touch targets should not feel smaller than `40px`

## Adoption Guidance

When application code is added:

1. Import `styles/design-tokens.css` at the global app entry.
2. Map existing component colors and spacing to the provided tokens.
3. Rebuild page sections using the surface, border, and shadow system before adding new custom styles.
4. Reuse motion durations and easing tokens for consistency.
