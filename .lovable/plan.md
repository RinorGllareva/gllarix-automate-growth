

# Replace "Stop Losing Revenue" with Appointwise-Style Comparison Section

## What Changes

The entire content of the PainSolution section will be replaced with a clean, data-driven "Outperforms Traditional Teams" layout matching the Appointwise reference screenshots. The dark background, grid pattern, and animations stay -- only the inner content changes.

---

## New Section Layout

### Header
- Pill badge: "Why AI Agents?"
- Main heading: **"Outperforms Traditional Teams."**
- Subtitle: "We will:"

### Three Comparison Cards (3-column grid)
Each card has a numbered title, a visual element built with CSS/SVG (bar chart, cost graph, globe/capacity graphic), and Human vs AI stats below.

**01. Increase Conversions**
- Visual: Simple CSS bar chart (short bar = Human, tall bar = AI) in green tones
- Human average: 10-20% (red text)
- AI average: 30-40% (green text)

**02. Reduce Expenses**
- Visual: CSS line/area graphic showing Human Setter Costs (high) vs AI Setter Costs (low)
- 1 human employee: $2,000/month (red text)
- Unlimited AI agents: fraction of the cost (green text)

**03. Maximize Capacity**
- Visual: Simple dotted globe/network CSS graphic
- Human capacity: 150 leads/day (red text)
- AI capacity: 10,000+ leads/day (green text)

### ROI Calculator (Interactive)
Three input fields with dark styling:
- Monthly Leads (default: 1000)
- Current Human Employees (default: 1)
- Average Deal Value (default: 5000)

Three result cards showing calculated values:
- Annual Savings (green animated number)
- Extra Appointments/Month (green animated number)
- Additional Revenue/Month (green animated number)

### Side-by-Side Comparison Bar
Two cards at the bottom:
- **Traditional Team**: Conversion Rate 15% (red progress bar), Monthly Cost $2000 (red)
- **Gllarix AI**: Conversion Rate 40% (green progress bar), Monthly Cost shown as significantly lower (green)

### CTA
- "Ready to see what AI can do for you?"
- Button: "Start Your Free Demo" linking to /book-meeting

---

## Pricing Section Update
The Pricing component stays but becomes more compact:
- Remove the large pricing card with $800-$5,000+ range and the 3 feature cards
- Keep only the "What Influences Your Price?" factors grid in a single compact row (4 columns on desktop)
- Keep the CTA at the bottom
- Remove `min-h-screen` from the pricing wrapper in Index.tsx

---

## Technical Details

### Files Modified

**`src/components/PainSolution.tsx`** -- Full content rewrite:
- Keep the same component shell: imports, useScrollAnimation hooks, background gradient, grid pattern
- Remove the pain points / solutions two-column layout entirely
- Add three numbered comparison cards in a responsive 3-column grid (stacks on mobile)
- Add an interactive ROI calculator using React useState for the 3 inputs, with computed results
- Add the Human vs AI comparison bar with CSS progress bars
- Add a CTA button at the bottom
- Keep scroll-triggered animations on each section
- Remove the 3D orb and old stats section (replaced by the calculator results)
- All visuals built with pure CSS (gradients, bars, shapes) -- no embedded images

**`src/components/Pricing.tsx`** -- Simplify:
- Remove the large main pricing card (lines 89-183) with dollar ranges, glow, feature cards
- Keep the "What Influences Your Price?" factors section but change from 2x2 grid to a single-row 4-column layout with smaller cards
- Keep the CTA at the bottom

**`src/pages/Index.tsx`** -- Minor:
- Remove `min-h-screen` from the pricing section wrapper (line 30) since it will be more compact
