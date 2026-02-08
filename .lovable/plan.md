

# Pixel-Perfect Comparison Cards + Edge Function Fix

## Overview
Two changes: (1) fix the build error in the edge function, and (2) redesign the three comparison cards in PainSolution to exactly match the Appointwise reference screenshot.

---

## 1. Fix Edge Function Build Error

The `send-contact-email` function fails because it imports Resend using `npm:resend@2.0.0` which is not supported in this Deno environment. The fix is to use the `esm.sh` CDN import instead.

**File:** `supabase/functions/send-contact-email/index.ts`
- Change line 2 from `import { Resend } from "npm:resend@2.0.0"` to `import { Resend } from "https://esm.sh/resend@2.0.0"`

---

## 2. Redesign Three Comparison Cards

Matching the reference image exactly requires these visual changes to `src/components/PainSolution.tsx`:

### Card 01 - Increase Conversions
**Current:** Red bar (short) + green bar (tall) with small labels
**Target:** Two green bars of different heights inside a dark chart area with subtle grid lines, labeled "HUMAN CVR" and "AI CVR" at the bottom axis. The chart area has a slightly darker background with a subtle border.

- Both bars are green (darker green for human, brighter green for AI)
- Chart has a subtle background panel with faint grid lines
- X-axis labels: "HUMAN CVR" and "AI CVR" in small caps gray text
- Stats below: Label text is small gray, values are large bold text (red for human, green for AI) -- displayed as block layout (label on one line, large value on next line)

### Card 02 - Reduce Expenses
**Current:** SVG with red + green area fills, small legend in corner
**Target:** Wavy green line chart with two curves -- the upper curve labeled "HUMAN SETTER COSTS" (with a tooltip-style label) and lower curve labeled "AI SETTER COSTS" (also tooltip-style). Both lines are green with gradient fills beneath. Small green dots mark data points on the curves.

- Both lines use green color (different shades/positions distinguish them)
- Tooltip-style labels: dark backgrounds with green border/text showing "HUMAN SETTER COSTS" and "AI SETTER COSTS"
- Green dot indicators on each curve
- Area fill gradient from green to transparent beneath each line

### Card 03 - Maximize Capacity
**Current:** Lucide Globe icon with animated dots
**Target:** A detailed 3D-looking globe with dotted continents (particle/dot pattern) and a green glow at the bottom. The globe appears more realistic with dotted texture representing landmasses.

- Replace the simple Lucide Globe icon with a custom SVG globe
- Dotted/particle pattern for continents
- Green glow effect at the bottom of the globe (radial gradient)
- Keep the animated pulse dots around it

### Card Layout (all three)
- Title format: "01." in green, then title text in white, both large (text-3xl to text-4xl)
- Darker card background: `bg-[#1a1a1f]` or similar dark gray with subtle rounded border
- Stats layout: Each stat is a block -- small gray label on first line, large colored value on second line (not side-by-side like current)
- Values use mixed font sizes: large number in bold + smaller unit text inline (e.g., "$2000" big + "/month" smaller)

---

## Technical Details

### Files Modified

**`supabase/functions/send-contact-email/index.ts`**
- Line 2: Change npm import to esm.sh import for Resend

**`src/components/PainSolution.tsx`**
- Lines 72-183: Complete rewrite of the three card contents
- Card 01: New bar chart SVG with green bars, grid lines, axis labels
- Card 02: New wavy line chart SVG with tooltip-style labels and green dots
- Card 03: Custom globe SVG with dotted continent pattern and green glow
- All three: Updated stat layout to block format with large values
- Title format updated to match reference (green number, white text, larger size)

### No other files change

