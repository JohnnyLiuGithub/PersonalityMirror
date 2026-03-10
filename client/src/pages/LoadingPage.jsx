import { motion } from 'framer-motion';

const LoadingPage = ({ loadingMessage, loadingStep, waitSeconds }) => {
  return (
    <motion.div
      key="loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center space-y-8 text-center min-h-[60vh]"
    >
      <div className="relative w-32 h-32">
        <div className="absolute inset-0 border-4 border-[#a855f7]/20 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-[#a855f7] border-t-transparent rounded-full animate-spin"></div>
        <div className="absolute inset-8 bg-[#a855f7]/10 rounded-full animate-pulse"></div>
      </div>

      <div className="space-y-4 max-w-md mx-auto">
        <h2 className="text-2xl font-light tracking-wide animate-pulse text-white">
          {loadingMessage || 'Analyzing...'}
        </h2>

        <p className="text-xs text-[#a1a1aa] font-mono">{`Waited ${waitSeconds}s`}</p>

        <div className="flex justify-center space-x-2 pt-4">
          <div className={`h-1 w-8 rounded-full transition-colors duration-500 ${['scoring', 'analysis', 'card'].includes(loadingStep) ? 'bg-[#a855f7]' : 'bg-[#18181b] border border-white/10'}`}></div>
          <div className={`h-1 w-8 rounded-full transition-colors duration-500 ${['analysis', 'card'].includes(loadingStep) ? 'bg-[#a855f7]' : 'bg-[#18181b] border border-white/10'}`}></div>
          <div className={`h-1 w-8 rounded-full transition-colors duration-500 ${loadingStep === 'card' ? 'bg-[#a855f7]' : 'bg-[#18181b] border border-white/10'}`}></div>
        </div>

        <p className="text-sm text-[#71717a] font-mono pt-2 opacity-70">
          {loadingStep === 'scoring' && <span>Scoring your answer profile...</span>}
          {loadingStep === 'analysis' && <span>Generating AI analysis... this may take a while.</span>}
          {loadingStep === 'card' && <span>Preparing share card...</span>}
        </p>
      </div>
    </motion.div>
  );
};

export default LoadingPage;
