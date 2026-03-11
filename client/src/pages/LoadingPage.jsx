const LoadingPage = ({ loadingMessage, loadingStep, waitSeconds }) => {
  return (
    <div
      key="loading"
      className="flex flex-col items-center justify-center space-y-8 text-center min-h-[60vh]"
    >
      <div className="relative w-32 h-32">
        <div className="absolute inset-0 border-4 border-[#a855f7]/20 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-[#a855f7] border-t-transparent rounded-full animate-spin"></div>
        <div className="absolute inset-8 bg-[#a855f7]/10 rounded-full animate-pulse"></div>
      </div>

      <div className="space-y-4 max-w-md mx-auto">
        <h2 className="text-2xl font-light tracking-wide animate-pulse text-white">
          {loadingMessage || '正在分析中...'}
        </h2>

        <p className="text-xs text-[#a1a1aa] font-mono">{`已等待 ${waitSeconds}s`}</p>

        <div className="flex justify-center space-x-2 pt-4">
          <div className={`h-1 w-8 rounded-full transition-colors duration-500 ${['scoring', 'analysis', 'card'].includes(loadingStep) ? 'bg-[#a855f7]' : 'bg-[#18181b] border border-white/10'}`}></div>
          <div className={`h-1 w-8 rounded-full transition-colors duration-500 ${['analysis', 'card'].includes(loadingStep) ? 'bg-[#a855f7]' : 'bg-[#18181b] border border-white/10'}`}></div>
          <div className={`h-1 w-8 rounded-full transition-colors duration-500 ${loadingStep === 'card' ? 'bg-[#a855f7]' : 'bg-[#18181b] border border-white/10'}`}></div>
        </div>

        <p className="text-sm text-[#71717a] font-mono pt-2 opacity-70">
          {loadingStep === 'scoring' && <span>正在计算六维得分...</span>}
          {loadingStep === 'analysis' && <span>正在生成 AI 解析，这一步可能会稍慢。</span>}
          {loadingStep === 'card' && <span>正在准备分享卡片...</span>}
        </p>
      </div>
    </div>
  );
};

export default LoadingPage;
