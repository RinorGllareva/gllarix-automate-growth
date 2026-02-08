import React from "react";
import Globe from "globe.gl";
import { csvParse } from "d3-dsv";

type PopPoint = { lat: number; lng: number; pop: number };

const CapacityCard = () => {
  const globeElRef = React.useRef<HTMLDivElement | null>(null);
  const globeRef = React.useRef<any>(null);
  const roRef = React.useRef<ResizeObserver | null>(null);

  React.useEffect(() => {
    const el = globeElRef.current;
    if (!el) return;

    // Create globe
    const world = new Globe(el, {
      rendererConfig: { antialias: true, alpha: true },
    })
      .globeImageUrl("/globe/earth-night.jpg")
      .bumpImageUrl("/globe/earth-topology.png")
      .backgroundImageUrl(null as any) // no stars
      .enablePointerInteraction(true) // no hover/click picking
      // Dot-like hex bins (flat)
      .hexBinPointWeight("pop")
      .hexBinResolution(5)
      .hexBinMerge(true)
      .hexAltitude(0.00008) // keep basically flat
      .hexTopColor(() => "rgba(255,255,255,0.92)") // white dots
      .hexSideColor(() => "rgba(16,185,129,0.22)"); // subtle green tint

    globeRef.current = world;

    // Lock user navigation but keep auto-rotate
    const controls = world.controls();
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableRotate = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.65;

    // Camera / crop similar to your reference
    world.pointOfView({ lat: 22, lng: -55, altitude: 1.5 });

    // Fit canvas to container
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      world.width(Math.max(1, Math.floor(width)));
      world.height(Math.max(1, Math.floor(height)));
    };
    fit();

    roRef.current = new ResizeObserver(fit);
    roRef.current.observe(el);

    // Load data
    fetch("/datasets/world_population.csv")
      .then((res) => {
        if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
        return res.text();
      })
      .then((csvText) => {
        const parsed = csvParse(csvText, (row: any) => ({
          lat: Number(row.lat),
          lng: Number(row.lng),
          pop: Number(row.pop),
        })) as unknown as PopPoint[];

        // NEVER trust data blindly (prevents globe.gl crash)
        const safe = parsed.filter(
          (d) =>
            Number.isFinite(d.lat) &&
            Number.isFinite(d.lng) &&
            Number.isFinite(d.pop) &&
            d.lat >= -90 &&
            d.lat <= 90 &&
            d.lng >= -180 &&
            d.lng <= 180,
        );

        world.hexBinPointsData(safe);
      })
      .catch((err) => console.error("World population load failed:", err));

    return () => {
      roRef.current?.disconnect();
      roRef.current = null;

      try {
        globeRef.current?._destructor?.();
      } catch {}
      globeRef.current = null;

      el.innerHTML = "";
    };
  }, []);

  return (
    <div className="bg-[#1a1a1f] border border-white/[0.06] rounded-2xl p-8 hover:border-primary/20 transition-all duration-300">
      {/* Title */}
      <div className="flex items-baseline gap-2 mb-6">
        <span className="text-green-400 text-3xl font-bold">03.</span>
        <h3 className="text-3xl font-bold text-white">Maximize Capacity</h3>
      </div>

      {/* Globe */}
      <div className="relative flex items-center justify-center mb-8">
        {/* subtle ambient glow behind */}
        <div className="pointer-events-none absolute -inset-10 rounded-full bg-emerald-400/10 blur-3xl" />

        {/* circle frame */}
        <div className="relative w-72 h-72 rounded-full overflow-hidden">
          {/* ✅ OUTSIDE green rim only (no inside glow) */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              boxShadow:
                "0 0 0 1px rgba(16,185,129,0.35), 0 0 40px rgba(16,185,129,0.55)",
            }}
          />

          {/* dark vignette (keeps edges premium, no green inside) */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              boxShadow: "inset 0 0 110px rgba(0,0,0,0.9)",
            }}
          />

          {/* globe canvas */}
          <div
            ref={globeElRef}
            className="absolute inset-0"
            style={{
              // ✅ make globe lighter and clearer
              filter: "brightness(2) contrast(1.1) saturate(1.05)",
              // crop/zoom similar to reference
              transform: "scale(1.1)",
              transformOrigin: "center",
            }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">
            Human capacity
          </span>
          <span className="text-red-400 text-2xl font-bold">
            150<span className="text-sm font-medium text-red-400/70">/day</span>
          </span>
        </div>
        <div>
          <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">
            AI capacity
          </span>
          <span className="text-green-400 text-2xl font-bold">
            10,000+
            <span className="text-sm font-medium text-green-400/70">/day</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default CapacityCard;
