

# Exact Globe Recreation for Capacity Card

## What's Wrong Currently
The current globe has ~80 randomly placed green dots, visible grid lines, and a weak glow. The reference image shows a dramatically different globe -- large, 3D-looking, with hundreds of white dots forming recognizable continents and a bold green atmospheric glow at the bottom.

## Exact Reference Analysis
From the reference image, the globe has:
- **Hundreds of small white/cream dots** forming continent shapes (not green)
- **Primarily showing the Americas** on the left, Europe/Africa on the right edge
- **No visible grid/latitude lines**
- **Dark ocean areas** (near black, blending with card background)
- **Strong teal/green glow** concentrated at the bottom of the globe, creating an "atmosphere" or aurora effect
- **3D depth** -- dots near the edges are dimmer, center dots are brighter
- **Large size** -- the globe takes up most of the card's visual space
- **Slight right-side lighting** suggesting a light source

## Technical Implementation

### File: `src/components/comparison/CapacityCard.tsx` -- Full rewrite of globe SVG

**Dot Generation (useMemo):**
- Create ~400-500 dots using detailed continent coordinate maps
- Each continent defined as a series of polygon-like boundary points with fill density
- North America: large cluster from Alaska down to Mexico, with recognizable shape
- South America: narrowing shape from Colombia to Argentina
- Europe: small cluster on the right side of the globe
- Africa: larger cluster right of center
- Use a seeded pseudo-random number generator (not Math.random()) so the dots are consistent between renders
- Each dot gets an opacity based on distance from globe center (edge fading for 3D effect)
- Dots are white/cream colored (rgba(255, 255, 255, opacity)), NOT green

**Globe SVG Changes:**
- Remove all latitude/longitude grid lines
- Remove the current green-filled circle -- replace with a very dark, nearly invisible fill
- Increase SVG viewBox and rendered size (from w-48 h-48 to w-64 h-64)
- Add a strong green radial gradient glow at the bottom -- larger and more vibrant than current
- Add a subtle dark-to-transparent radial gradient on the globe itself for 3D depth
- Globe border stroke: very faint white instead of green

**Green Atmosphere Glow:**
- Large ellipse below the globe with a radial gradient
- Center color: bright teal/green (rgb(16, 185, 129)) at ~40% opacity
- Spreads outward, fading to transparent
- Extends wider than the globe itself
- A second, tighter glow ellipse overlapping the bottom of the globe for the "atmosphere hugging the surface" look

**Remove:**
- All animated pulse dots around the globe (the floating green dots) -- not present in reference
- All latitude/longitude ellipse lines

**Seeded Random for Consistency:**
- Use a simple linear congruential generator seeded with a fixed value so dots don't change on re-render

### No other files change
Only `src/components/comparison/CapacityCard.tsx` is modified. The stats section at the bottom remains identical.
