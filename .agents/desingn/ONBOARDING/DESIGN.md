---
name: Liquid Spatial SaaS
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c4c7c8'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c6c6c7'
  primary: '#ffffff'
  on-primary: '#2f3131'
  primary-container: '#e2e2e2'
  on-primary-container: '#636565'
  inverse-primary: '#5d5f5f'
  secondary: '#adc6ff'
  on-secondary: '#002e69'
  secondary-container: '#4b8eff'
  on-secondary-container: '#00285c'
  tertiary: '#ffffff'
  on-tertiary: '#1000a9'
  tertiary-container: '#e1e0ff'
  on-tertiary-container: '#4f51dd'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c7'
  on-primary-fixed: '#1a1c1c'
  on-primary-fixed-variant: '#454747'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a41'
  on-secondary-fixed-variant: '#004493'
  tertiary-fixed: '#e1e0ff'
  tertiary-fixed-dim: '#c0c1ff'
  on-tertiary-fixed: '#07006c'
  on-tertiary-fixed-variant: '#2f2ebe'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
    letterSpacing: -0.04em
  display-lg-mobile:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: 0em
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  bento-gap: 24px
  panel-padding: 32px
  container-margin: 40px
  touch-target-min: 48px
---

## Brand & Style
The design system embodies "SaaS 2026," a forward-leaning aesthetic that merges the utility of professional developer tools with the immersive depth of spatial computing. The brand personality is technical yet ethereal, prioritizing clarity through physical metaphors of light and glass rather than heavy color application.

The core style is **Spatial Glassmorphism**. This approach utilizes high-refraction surfaces, dynamic background blurs, and "Liquid Glass" textures to create a UI that feels suspended in a three-dimensional environment. It is designed to be theme-agnostic (White Label), adapting its soul to the content it hosts by using the underlying environment or imagery to tint the translucent interface. The emotional response is one of effortless precision, calm productivity, and high-end craftsmanship.

## Colors
The palette is intentionally monochromatic to support a white-label architecture, relying on luminosity rather than hue for hierarchy.

- **Primary:** Pure White (#FFFFFF) is used for high-contrast text and critical interactive states.
- **Surface:** The "Liquid Glass" base is derived from a deep neutral (#0A0A0A) at varying opacities (10% to 40%) combined with a 40px backdrop blur.
- **Accents:** Secondary and Tertiary colors are reserved for functional signaling (success, warning, or specific brand highlights) and are often rendered with a subtle glow or "inner light" effect.
- **Glass Strokes:** Borders use a semi-transparent white (10-15% opacity) to simulate the edge of a glass pane, catching "virtual" light from above.

## Typography
The system uses **Geist** for its clinical, technical precision and high legibility in professional environments. For data-heavy POS elements like SKU numbers, prices, and timestamps, **JetBrains Mono** provides a monospaced structure that reinforces the "pro-tool" aesthetic.

Typography hierarchy is driven by weight and opacity. Primary information is at 100% opacity white; secondary information drops to 60% (muted); tertiary/meta-data drops to 40%. Headers utilize tight letter-spacing to maintain a compact, "Bento-style" density within large floating panels.

## Layout & Spacing
This design system utilizes a **Bento Grid** philosophy nested within a **Fluid Spatial Layout**. Content is organized into discrete "suspended" cards that follow a strictly proportional grid.

- **The Bento Logic:** Elements should be grouped into cards with a standard 24px gap.
- **Breathable Margins:** High negative space is mandatory. Panels should never touch the edge of the viewport, maintaining a minimum 40px "air buffer."
- **Touch-First SaaS:** While the aesthetic is professional, the POS context requires large touch targets. All interactive elements must occupy at least a 48px square area, even if the visual icon is smaller.
- **Adaptive Reflow:** On mobile, the Bento grid collapses into a single-column stack of cards, but maintains the 24px corner radius and glass treatment.

## Elevation & Depth
Hierarchy is established through "Z-axis layering" rather than shadows alone.

1.  **Level 0 (Background):** A dark, dynamic gradient or high-blur environmental image.
2.  **Level 1 (Main Canvas):** The base glass layer with 20px blur and a 1px soft white stroke (10% opacity).
3.  **Level 2 (Floating Cards/Bento):** Suspended 8px above the canvas. These feature a more pronounced 1px border and a realistic, wide-spread soft shadow (0px 20px 40px rgba(0,0,0,0.4)).
4.  **Level 3 (Modals/Overlays):** Elevated 32px above the canvas. These use a "Liquid Glass" effect—higher opacity, 60px blur, and a subtle inner-glow on the top edge to simulate overhead lighting.

Use **Subtle Reflections**: A linear gradient mask (white to transparent) at 5% opacity should be applied to the top-left quadrant of primary panels to simulate light hitting the glass surface.

## Shapes
The shape language is defined by oversized, friendly, yet architectural radii. 

- **Base Cards:** Use a fixed **24px-28px radius** to create the "Liquid" feel.
- **Inner Elements:** Buttons and inputs should nested with a slightly smaller radius (typically 12px-16px) to maintain visual concentricity.
- **Interactive States:** When hovered or pressed, shapes should subtly expand (1-2%) to simulate physical responsiveness.

## Components
- **Floating Panels:** The primary container. Must have backdrop-filter: blur(40px) and a 1px border-top that is slightly brighter than the side borders.
- **Suspended Cards:** Used for individual items in the POS. On hover, the border opacity should increase from 15% to 40%.
- **Liquid Inputs:** Fields are transparent with a bottom-only or soft-outline border. The focus state triggers a soft outer glow in the primary color.
- **Glass Buttons:** Primary buttons are solid white with dark text. Secondary buttons are glass-filled with a 1px white border. Both feature a 24px corner radius.
- **Transaction Lists:** Use high-contrast typography (Geist for labels, JetBrains Mono for values) with 16px vertical padding between items. No dividers—use whitespace to separate rows.
- **Status Chips:** Small, pill-shaped indicators using low-saturation background tints and high-saturation text to maintain the professional aesthetic without being loud.