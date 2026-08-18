---
name: DevOps Professional Portfolio
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#0b1c30'
  on-tertiary-container: '#75859d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-sm:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-code:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-max: 1120px
  gutter: 24px
  margin-mobile: 16px
  section-gap: 80px
  stack-gap-sm: 8px
  stack-gap-md: 16px
---

## Brand & Style

The design system is built for a high-level DevOps Engineer, prioritizing **technical authority, precision, and clarity**. The brand personality is grounded and efficient, reflecting the reliability required in infrastructure management. 

The aesthetic follows a **Minimalist / Corporate Modern** direction. It leverages significant white space to allow dense technical information to breathe, while using structural elements like thin borders and systematic grids to evoke the feeling of organized code and architecture diagrams. The UI should evoke a sense of calm under pressure—a hallmark of an expert engineer.

## Colors

The palette is anchored by **Slate Gray (#0F172A)** for primary text and brand elements, providing a deep, professional contrast against a clean **Off-White (#F8FAFC)** background. 

- **Primary:** Deep Slate. Used for core branding, headlines, and primary actions.
- **Secondary:** Azure Blue. Used for links, primary call-to-actions, and active states to represent connectivity and cloud technology.
- **Tertiary/Muted:** Cool Gray. Used for metadata, secondary labels, and descriptive text.
- **Accent:** Emerald. Used sparingly for status indicators (e.g., "99.99% Availability") to symbolize health and success.

Use subtle border colors (#E2E8F0) to define sections without adding visual clutter.

## Typography

This design system uses a triple-font approach to balance personality and utility:
1. **Geist (Headlines):** A technical, sharp sans-serif that conveys modern engineering.
2. **Inter (Body):** The industry standard for readability, used for all long-form descriptions and resume content.
3. **JetBrains Mono (Labels/Technical):** Used for tags, technology stacks (e.g., "AWS", "Terraform"), and small metadata to reinforce the developer persona.

Keep line lengths for body text between 60-75 characters to ensure maximum readability of technical achievements.

## Layout & Spacing

The layout utilizes a **Fixed Grid** model for desktop to ensure a curated, editorial feel. 
- **Desktop:** 12-column grid within a 1120px container. Large section gaps (80px) separate the Profile, Experience, and Skills sections.
- **Mobile:** Single column with 16px side margins. Typography scales down to `headline-lg-mobile` for section titles.

Use a "Stack" philosophy for technical lists (like the Experience section):
- Small gaps (8px) between a bullet point and its sub-points.
- Medium gaps (16px) between the company title and the roles.
- Large gaps (32px) between different job entries.

## Elevation & Depth

To maintain a clean, "infrastructure-as-code" aesthetic, this design system avoids heavy shadows. Instead, it uses **Tonal Layers** and **Low-Contrast Outlines**:

1. **Surface 0 (Background):** Primary white/off-white background.
2. **Surface 1 (Cards/Containers):** A subtle border (#E2E8F0) with no shadow. Use a very light gray background (#F1F5F9) on hover for interactive elements.
3. **Separators:** Use horizontal rules (1px, #0F172A) for section headers to mimic the provided CV style, creating clear visual "break points" in the technical narrative.

## Shapes

The shape language is **Soft (0.25rem)**. While a DevOps portfolio needs to feel precise (sharp), absolute sharp corners can feel dated. A minimal radius provides a contemporary finish without sacrificing the professional tone.

- **Standard Elements:** 4px (0.25rem) radius for buttons and input fields.
- **Tags/Chips:** 4px radius (avoid pill-shapes to maintain a more "structured" look).
- **Cards:** 8px (0.5rem) radius for larger containers like project highlights.

## Components

### Buttons
- **Primary:** Solid Slate (#0F172A) background with white text. No shadow.
- **Secondary:** Transparent background with a Slate border and text.
- **States:** On hover, primary buttons shift to Secondary Blue (#3B82F6).

### Tech Chips (Skill Tags)
- Use `label-code` typography.
- Light gray background (#F1F5F9) with a subtle border.
- Group by category (e.g., Cloud, CI/CD, Orchestration).

### Experience List
- Use the 1px horizontal rule above company names.
- Bold the "Role Title" and use `tertiary_color_hex` for the dates.
- Use square or custom SVG icons (like a small terminal prompt `>`) for bullet points to lean into the technical theme.

### Cards (Projects/Certificates)
- Flat design with a 1px border.
- On hover, add a subtle blue left-border (3px) to indicate interactivity and focus.

### Status Indicators
- Small circular dots for "System Availability" or "Project Status."
- Use `accent_success` for positive metrics.