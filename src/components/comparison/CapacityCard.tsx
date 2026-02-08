import React from "react";

const CapacityCard = () => {
  // Generate dotted continent-like pattern points
  const globePoints = React.useMemo(() => {
    const points: { x: number; y: number; opacity: number }[] = [];
    const cx = 100;
    const cy = 95;
    const r = 70;

    // Create continent-like clusters
    const continentSeeds = [
      // North America
      { ax: -30, ay: -35, spread: 20, count: 18 },
      // South America
      { ax: -15, ay: 10, spread: 14, count: 12 },
      // Europe
      { ax: 10, ay: -35, spread: 12, count: 10 },
      // Africa
      { ax: 15, ay: -5, spread: 16, count: 14 },
      // Asia
      { ax: 35, ay: -30, spread: 22, count: 20 },
      // Australia
      { ax: 45, ay: 20, spread: 10, count: 8 },
    ];

    continentSeeds.forEach(({ ax, ay, spread, count }) => {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const dist = Math.random() * spread;
        const px = cx + ax + Math.cos(angle) * dist;
        const py = cy + ay + Math.sin(angle) * dist;

        // Only include points inside the globe circle
        const dx = px - cx;
        const dy = py - cy;
        if (Math.sqrt(dx * dx + dy * dy) < r - 3) {
          // Edge fading
          const distFromCenter = Math.sqrt(dx * dx + dy * dy) / r;
          const edgeOpacity = Math.max(0.2, 1 - distFromCenter * 0.7);
          points.push({ x: px, y: py, opacity: edgeOpacity * (0.4 + Math.random() * 0.6) });
        }
      }
    });

    return points;
  }, []);

  return (
    <div className="bg-[#1a1a1f] border border-white/[0.06] rounded-2xl p-8 hover:border-primary/20 transition-all duration-300">
      {/* Title */}
      <div className="flex items-baseline gap-2 mb-8">
        <span className="text-green-400 text-3xl font-bold">03.</span>
        <h3 className="text-3xl font-bold text-white">Maximize Capacity</h3>
      </div>

      {/* Globe Visual */}
      <div className="relative flex items-center justify-center mb-8">
        <svg viewBox="0 0 200 200" className="w-48 h-48">
          <defs>
            {/* Globe green glow */}
            <radialGradient id="globeGlow" cx="50%" cy="85%" r="50%" fx="50%" fy="85%">
              <stop offset="0%" stopColor="rgb(74, 222, 128)" stopOpacity="0.3" />
              <stop offset="50%" stopColor="rgb(74, 222, 128)" stopOpacity="0.08" />
              <stop offset="100%" stopColor="rgb(74, 222, 128)" stopOpacity="0" />
            </radialGradient>
            {/* Globe body gradient */}
            <radialGradient id="globeBody" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="rgba(74, 222, 128, 0.08)" />
              <stop offset="100%" stopColor="rgba(74, 222, 128, 0.02)" />
            </radialGradient>
          </defs>

          {/* Green glow at bottom */}
          <ellipse cx="100" cy="170" rx="70" ry="30" fill="url(#globeGlow)" />

          {/* Globe circle */}
          <circle cx="100" cy="95" r="70" fill="url(#globeBody)" stroke="rgba(74, 222, 128, 0.15)" strokeWidth="1" />

          {/* Latitude lines */}
          {[-40, -20, 0, 20, 40].map((offset, i) => (
            <ellipse
              key={i}
              cx="100"
              cy={95 + offset}
              rx={Math.sqrt(Math.max(0, 70 * 70 - offset * offset))}
              ry={6}
              fill="none"
              stroke="rgba(74, 222, 128, 0.06)"
              strokeWidth="0.5"
            />
          ))}

          {/* Longitude lines */}
          {[70, 85, 100, 115, 130].map((x, i) => (
            <ellipse
              key={i}
              cx={x}
              cy="95"
              rx="6"
              ry="70"
              fill="none"
              stroke="rgba(74, 222, 128, 0.06)"
              strokeWidth="0.5"
            />
          ))}

          {/* Dotted continents */}
          {globePoints.map((point, i) => (
            <circle
              key={i}
              cx={point.x}
              cy={point.y}
              r="1.5"
              fill="rgb(74, 222, 128)"
              opacity={point.opacity}
            />
          ))}
        </svg>

        {/* Animated pulse dots around globe */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"
            style={{
              top: `${25 + Math.sin(i * 1.05) * 30}%`,
              left: `${25 + Math.cos(i * 1.05) * 30}%`,
              animationDelay: `${i * 300}ms`,
              opacity: 0.6,
            }}
          />
        ))}
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
