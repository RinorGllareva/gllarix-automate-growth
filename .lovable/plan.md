
# Fix Broken Logo

The logo isn't showing because `Navigation.tsx` references `/Gllarix_Icon PNG.png` which doesn't exist. The actual files in `public/` are:
- `Gllarix_LogoPNG.png` (likely the icon/logo)
- `Gllarix_NamePNG.png` (likely the text wordmark)

## Changes

**`src/components/Navigation.tsx` (line 15):** Change `src="/Gllarix_Icon PNG.png"` to `src="/Gllarix_LogoPNG.png"`

**`src/pages/About.tsx` (line 240):** Change `"./Gllarix_Icon PNG.png"` to `"/Gllarix_LogoPNG.png"`
