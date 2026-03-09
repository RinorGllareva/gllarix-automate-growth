

# Fix Favicon to Match Header Logo

The header uses `/gllarix-icon-180.png.png` but the favicon references `/favicon-32.png` (which was auto-generated and doesn't look right). Simply update `index.html` to use the same G icon file as the header.

## Change

**`index.html`**: Update the favicon `<link>` tag to reference `/gllarix-icon-180.png.png` instead of `/favicon-32.png`. Also update the apple-touch-icon to the same file.

