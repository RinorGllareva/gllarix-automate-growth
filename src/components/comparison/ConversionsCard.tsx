import React from "react";

const ConversionsCard = () => {
  return (
    <div className="bg-[#1a1a1f] border border-white/[0.06] rounded-2xl p-8 hover:border-primary/20 transition-all duration-300">
      {/* Title */}
      <div className="flex items-baseline gap-2 mb-8">
        <span className="text-green-400 text-3xl font-bold">01.</span>
        <h3 className="text-3xl font-bold text-white">Increase Conversions</h3>
      </div>

      {/* Bar Chart */}
      <div className="relative bg-[#13131a] border border-white/[0.04] rounded-xl p-6 mb-8">
        {/* Grid lines */}
        <div className="absolute inset-6 flex flex-col justify-between pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-full h-px bg-white/[0.04]" />
          ))}
        </div>

        {/* Bars */}
        <div className="relative flex items-end justify-center gap-12 h-36">
          {/* Human Bar */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-14 rounded-t-md"
              style={{
                height: '50px',
                background: 'linear-gradient(180deg, rgba(74, 222, 128, 0.4) 0%, rgba(74, 222, 128, 0.15) 100%)',
                border: '1px solid rgba(74, 222, 128, 0.2)',
              }}
            />
            <span className="text-[10px] text-gray-500 tracking-wider uppercase font-medium">Human CVR</span>
          </div>
          {/* AI Bar */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-14 rounded-t-md"
              style={{
                height: '110px',
                background: 'linear-gradient(180deg, rgba(74, 222, 128, 0.7) 0%, rgba(74, 222, 128, 0.3) 100%)',
                border: '1px solid rgba(74, 222, 128, 0.4)',
                boxShadow: '0 0 20px rgba(74, 222, 128, 0.15)',
              }}
            />
            <span className="text-[10px] text-gray-500 tracking-wider uppercase font-medium">AI CVR</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Human setter average</span>
          <span className="text-red-400 text-2xl font-bold">10-20<span className="text-base font-medium">%</span></span>
        </div>
        <div>
          <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">AI setter average</span>
          <span className="text-green-400 text-2xl font-bold">30-40<span className="text-base font-medium">%</span></span>
        </div>
      </div>
    </div>
  );
};

export default ConversionsCard;
