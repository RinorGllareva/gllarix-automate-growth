import React from "react";

// Seeded pseudo-random number generator (LCG) for consistent dots
function createRNG(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// Point-in-polygon test (ray casting)
function pointInPolygon(px: number, py: number, polygon: [number, number][]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

const CapacityCard = () => {
  const globePoints = React.useMemo(() => {
    const rng = createRNG(42);
    const points: { x: number; y: number; opacity: number; r: number }[] = [];
    const cx = 150;
    const cy = 150;
    const globeR = 120;

    // Continent polygons mapped onto the globe's 300x300 viewBox
    // Globe center is (150, 150), radius 120
    // These approximate the Americas view with Europe/Africa on the right edge

    // North America (Alaska down to Mexico)
    const northAmerica: [number, number][] = [
      [55, 45], [60, 40], [70, 35], [80, 32], [90, 30], [100, 32],
      [105, 35], [108, 40], [112, 38], [115, 42], [110, 50],
      [108, 55], [112, 60], [115, 65], [118, 72], [120, 80],
      [122, 88], [125, 95], [128, 100], [130, 108], [128, 115],
      [125, 120], [120, 125], [115, 128], [108, 130], [100, 128],
      [95, 130], [90, 132], [85, 128], [82, 122], [78, 115],
      [75, 108], [72, 100], [68, 92], [65, 85], [60, 78],
      [55, 70], [52, 62], [50, 55], [52, 48], [55, 45],
    ];

    // Central America & Caribbean
    const centralAmerica: [number, number][] = [
      [108, 130], [112, 135], [115, 140], [118, 145], [120, 150],
      [118, 152], [115, 148], [110, 145], [108, 140], [105, 135],
      [108, 130],
    ];

    // South America
    const southAmerica: [number, number][] = [
      [118, 152], [122, 155], [128, 160], [132, 168], [135, 175],
      [138, 185], [140, 195], [138, 205], [135, 215], [132, 222],
      [128, 228], [125, 235], [120, 240], [115, 245], [112, 248],
      [108, 245], [105, 240], [102, 232], [100, 225], [98, 218],
      [96, 210], [95, 200], [96, 192], [98, 185], [100, 178],
      [102, 170], [105, 165], [108, 160], [112, 155], [118, 152],
    ];

    // Europe (right edge of globe)
    const europe: [number, number][] = [
      [195, 48], [200, 45], [208, 42], [215, 45], [220, 50],
      [225, 55], [228, 62], [230, 68], [228, 75], [225, 80],
      [220, 85], [215, 90], [210, 92], [205, 88], [200, 82],
      [195, 75], [192, 68], [190, 60], [192, 52], [195, 48],
    ];

    // Africa (right side)
    const africa: [number, number][] = [
      [200, 95], [205, 92], [212, 95], [218, 100], [222, 108],
      [225, 118], [228, 128], [230, 138], [228, 150], [225, 160],
      [222, 170], [218, 178], [215, 185], [210, 192], [205, 198],
      [200, 200], [195, 195], [192, 188], [190, 178], [188, 168],
      [186, 158], [185, 148], [186, 138], [188, 128], [190, 118],
      [192, 108], [195, 100], [200, 95],
    ];

    // Greenland
    const greenland: [number, number][] = [
      [120, 35], [128, 32], [135, 35], [140, 40], [142, 48],
      [140, 55], [135, 58], [128, 56], [122, 52], [118, 45],
      [118, 38], [120, 35],
    ];

    const continents = [northAmerica, centralAmerica, southAmerica, europe, africa, greenland];

    // Fill each continent with dots
    for (const polygon of continents) {
      // Find bounding box
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [px, py] of polygon) {
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }

      // Generate candidate dots within bounding box
      const density = 3.2; // spacing between dot candidates
      for (let x = minX; x <= maxX; x += density) {
        for (let y = minY; y <= maxY; y += density) {
          // Add slight jitter for natural look
          const jx = x + (rng() - 0.5) * 2.0;
          const jy = y + (rng() - 0.5) * 2.0;

          if (!pointInPolygon(jx, jy, polygon)) continue;

          // Check if inside globe circle
          const dx = jx - cx;
          const dy = jy - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > globeR - 2) continue;

          // 3D sphere depth: dots near edge are dimmer
          const normalizedDist = dist / globeR;
          const sphereDepth = Math.sqrt(Math.max(0, 1 - normalizedDist * normalizedDist));

          // Slight right-side lighting bias
          const lightBias = 0.5 + 0.5 * (dx / globeR);

          const opacity = sphereDepth * (0.5 + lightBias * 0.5) * (0.6 + rng() * 0.4);
          const dotR = 1.2 + sphereDepth * 0.6;

          points.push({ x: jx, y: jy, opacity: Math.min(1, opacity), r: dotR });
        }
      }
    }

    return points;
  }, []);

  return (
    <div className="bg-[#1a1a1f] border border-white/[0.06] rounded-2xl p-8 hover:border-primary/20 transition-all duration-300">
      {/* Title */}
      <div className="flex items-baseline gap-2 mb-6">
        <span className="text-green-400 text-3xl font-bold">03.</span>
        <h3 className="text-3xl font-bold text-white">Maximize Capacity</h3>
      </div>

      {/* Globe Visual */}
      <div className="relative flex items-center justify-center mb-8">
        <svg viewBox="0 0 300 300" className="w-64 h-64">
          <defs>
            {/* Bottom atmosphere glow - wide spread */}
            <radialGradient id="capacityAtmosphereWide" cx="50%" cy="95%" r="55%" fx="50%" fy="95%">
              <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.35" />
              <stop offset="35%" stopColor="rgb(16, 185, 129)" stopOpacity="0.15" />
              <stop offset="65%" stopColor="rgb(16, 185, 129)" stopOpacity="0.05" />
              <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0" />
            </radialGradient>

            {/* Tight glow hugging the bottom of the globe */}
            <radialGradient id="capacityAtmosphereTight" cx="50%" cy="88%" r="35%" fx="50%" fy="88%">
              <stop offset="0%" stopColor="rgb(52, 211, 153)" stopOpacity="0.25" />
              <stop offset="50%" stopColor="rgb(16, 185, 129)" stopOpacity="0.1" />
              <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0" />
            </radialGradient>

            {/* Globe body - very dark with subtle depth */}
            <radialGradient id="capacityGlobeBody" cx="55%" cy="40%" r="65%">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.03)" />
              <stop offset="100%" stopColor="rgba(0, 0, 0, 0.1)" />
            </radialGradient>
          </defs>

          {/* Wide atmospheric glow behind globe */}
          <ellipse cx="150" cy="280" rx="140" ry="60" fill="url(#capacityAtmosphereWide)" />

          {/* Tight atmospheric glow overlapping bottom of globe */}
          <ellipse cx="150" cy="260" rx="100" ry="40" fill="url(#capacityAtmosphereTight)" />

          {/* Globe circle - very dark, near invisible */}
          <circle
            cx="150"
            cy="150"
            r="120"
            fill="url(#capacityGlobeBody)"
            stroke="rgba(255, 255, 255, 0.06)"
            strokeWidth="0.8"
          />

          {/* Continent dots - white/cream */}
          {globePoints.map((point, i) => (
            <circle
              key={i}
              cx={point.x}
              cy={point.y}
              r={point.r}
              fill="rgba(255, 255, 255, 1)"
              opacity={point.opacity}
            />
          ))}
        </svg>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Human capacity</span>
          <span className="text-red-400 text-2xl font-bold">150<span className="text-sm font-medium text-red-400/70">/day</span></span>
        </div>
        <div>
          <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">AI capacity</span>
          <span className="text-green-400 text-2xl font-bold">10,000+<span className="text-sm font-medium text-green-400/70">/day</span></span>
        </div>
      </div>
    </div>
  );
};

export default CapacityCard;
