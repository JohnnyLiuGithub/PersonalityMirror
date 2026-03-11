const ReportSection = ({ title, content, isList, warning, success, shadow, fullWidth }) => {
  return (
    <div
      className={`
        p-6 rounded-2xl bg-[#18181b]/50 border border-white/5 hover:border-white/10 transition-colors
        ${fullWidth ? 'col-span-full' : ''}
        ${warning ? 'border-red-500/20 bg-red-500/5' : ''}
        ${success ? 'border-green-500/20 bg-green-500/5' : ''}
        ${shadow ? 'border-purple-500/20 bg-purple-500/5' : ''}
      `}
    >
      <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 
        ${warning ? 'text-red-400' : success ? 'text-green-400' : shadow ? 'text-purple-400' : 'text-[#a855f7]'}`}>
        {title}
      </h3>

      {isList && Array.isArray(content) ? (
        <ul className="space-y-2">
          {content.map((item, idx) => (
            <li key={idx} className="flex items-start text-[#71717a]/90 text-sm leading-relaxed">
              <span className="mr-2 text-[#a855f7]/50">-</span>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[#71717a]/90 text-sm leading-relaxed whitespace-pre-line">
          {content}
        </p>
      )}
    </div>
  );
};

export default ReportSection;
