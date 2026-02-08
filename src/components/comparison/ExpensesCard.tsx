import React from "react";

const ExpensesCard = () => {
  return (
    <div className="bg-[#1a1a1f] border border-white/[0.06] rounded-2xl p-8 hover:border-primary/20 transition-all duration-300">
      {/* Title */}
      <div className="flex items-baseline gap-2 mb-8">
        <span className="text-green-400 text-3xl font-bold">02.</span>
        <h3 className="text-3xl font-bold text-white">Reduce Expenses</h3>
      </div>

      {/* Line Chart */}
      <div className="relative bg-[#13131a] border border-white/[0.04] rounded-xl p-4 mb-8">
        <svg viewBox="0 0 280 140" className="w-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            {/* Human cost gradient fill */}
            <linearGradient id="humanCostGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(222, 74, 74)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="rgb(222, 74, 74)" stopOpacity="0.02" />
            </linearGradient>
            {/* AI cost gradient fill */}
            <linearGradient id="aiCostGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(74, 222, 128)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="rgb(74, 222, 128)" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[28, 56, 84, 112].map((y) => (
            <line key={y} x1="0" y1={y} x2="280" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          ))}

          {/* Human cost area */}
          <path
            d="M0,45 C30,40 60,50 90,42 C120,34 150,48 180,40 C210,32 240,44 280,38 L280,140 L0,140 Z"
            fill="url(#humanCostGrad)"
          />
          {/* Human cost line */}
          <path
            d="M0,45 C30,40 60,50 90,42 C120,34 150,48 180,40 C210,32 240,44 280,38"
            stroke="rgb(222, 74, 74)"
            strokeWidth="2"
            fill="none"
            opacity="0.7"
          />

          {/* AI cost area */}
          <path
            d="M0,100 C30,96 60,104 90,98 C120,92 150,102 180,96 C210,90 240,100 280,94 L280,140 L0,140 Z"
            fill="url(#aiCostGrad)"
          />
          {/* AI cost line */}
          <path
            d="M0,100 C30,96 60,104 90,98 C120,92 150,102 180,96 C210,90 240,100 280,94"
            stroke="rgb(74, 222, 128)"
            strokeWidth="2"
            fill="none"
            opacity="0.5"
          />

          {/* Data points - Human */}
          {[
            [0, 45], [90, 42], [180, 40], [280, 38]
          ].map(([cx, cy], i) => (
            <circle key={`h-${i}`} cx={cx} cy={cy} r="3" fill="rgb(74, 222, 128)" opacity="0.8" />
          ))}

          {/* Data points - AI */}
          {[
            [0, 100], [90, 98], [180, 96], [280, 94]
          ].map(([cx, cy], i) => (
            <circle key={`a-${i}`} cx={cx} cy={cy} r="3" fill="rgb(74, 222, 128)" opacity="0.5" />
          ))}
        </svg>

        {/* Tooltip-style labels */}
        <div className="absolute top-3 left-3">
          <div className="bg-[#1a1a1f]/90 border border-green-500/20 rounded-md px-2.5 py-1">
            <span className="text-green-400 text-[9px] uppercase tracking-wider font-medium">Human Setter Costs</span>
          </div>
        </div>
        <div className="absolute bottom-12 left-3">
          <div className="bg-[#1a1a1f]/90 border border-green-500/20 rounded-md px-2.5 py-1">
            <span className="text-green-400/70 text-[9px] uppercase tracking-wider font-medium">AI Setter Costs</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">1 human setter</span>
          <span className="text-red-400 text-2xl font-bold">$2,000<span className="text-sm font-medium text-red-400/70">/mo</span></span>
        </div>
        <div>
          <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Unlimited AI setters</span>
          <span className="text-green-400 text-2xl font-bold">65%<span className="text-sm font-medium text-green-400/70">/lower</span></span>
        </div>
      </div>
    </div>
  );
};

export default ExpensesCard;
