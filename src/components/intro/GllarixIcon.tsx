import { GEO } from "./gllarixMark";

const [ix, iy, iw, ih] = GEO.ibox;

export const ICON_VIEWBOX = `${ix} ${iy} ${iw} ${ih}`;
export const ICON_ASPECT = iw / ih;

interface GllarixIconProps {
  className?: string;
}

/** The Gllarix mark as a tight-fitting SVG: its box is exactly the icon, so the intro can dock onto it pixel for pixel. */
const GllarixIcon = ({ className }: GllarixIconProps) => (
  <svg
    viewBox={ICON_VIEWBOX}
    className={className}
    style={{ aspectRatio: `${iw} / ${ih}` }}
    aria-hidden="true"
    focusable="false"
  >
    <path fill="#fff" d={GEO.iconD} />
  </svg>
);

export default GllarixIcon;
