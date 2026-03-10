const PersonalityCard = ({ report, mirrorId }) => {
  const traits = Array.isArray(report?.card_traits) ? report.card_traits.slice(0, 3) : [];

  return (
    <div className="w-[320px] h-[568px] bg-[#18181b] border border-white/10 rounded-3xl overflow-hidden flex flex-col relative shadow-2xl shadow-black/50 select-none">
      <div className="absolute inset-0 bg-gradient-to-br from-[#a855f7]/20 via-[#09090b] to-[#ec4899]/20 opacity-50"></div>

      <div className="relative z-10 flex flex-col h-full p-8 text-center space-y-6">
        <div className="space-y-2 pt-4">
          <div className="w-12 h-1 bg-gradient-to-r from-[#a855f7] to-[#ec4899] mx-auto rounded-full"></div>
          <h3 className="text-[10px] font-mono text-[#71717a] uppercase tracking-[0.3em]">Personality Mirror</h3>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <div className="text-center">
            <div className="text-[10px] text-[#71717a] uppercase tracking-widest mb-1">Main Persona</div>
            <h1 className="text-3xl font-bold text-white leading-tight">{report?.card_label}</h1>
          </div>

          {report?.card_shadow_label && (
            <div className="text-center border-t border-white/10 pt-4 w-full">
              <div className="text-[10px] text-[#71717a] uppercase tracking-widest mb-1">Shadow Persona</div>
              <h2 className="text-xl font-medium text-white/80">{report.card_shadow_label}</h2>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {traits.map((trait, i) => (
              <span key={i} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-[#a855f7]/80 font-medium tracking-wide uppercase">
                {trait}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-6 pb-8">
          <p className="text-base font-light italic text-white/80 leading-relaxed px-2">"{report?.card_insight}"</p>

          <div className="pt-6 border-t border-white/5 flex justify-between items-end">
            <div className="text-left space-y-1">
              <div className="text-[8px] text-[#71717a] uppercase tracking-widest">Mirror ID</div>
              <div className="text-[10px] font-mono text-white/50">{mirrorId}</div>
            </div>
            <div className="text-right">
              <div className="text-[8px] text-[#71717a] uppercase tracking-widest mb-1">Start Your Mirror</div>
              <div className="text-[10px] font-mono text-[#a855f7]">personalitymirror.ai</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalityCard;
