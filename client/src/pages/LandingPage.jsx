import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const LandingPage = ({ onStart, isLoading, waitSeconds, frontendVersion, backendVersion, error }) => {
  return (
    <motion.div
      key="landing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="text-center space-y-8"
    >
      <div className="space-y-4">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-[#a855f7] via-white to-[#ec4899] pb-2">
          Personality Mirror
        </h1>
        <p className="text-xl md:text-2xl text-[#71717a] font-light max-w-lg mx-auto leading-relaxed">
          A mirror that does not flatter you.
          <br />
          <span className="text-sm opacity-60 font-mono mt-2 block">
            12 questions to reflect the part of you that is hardest to admit.
          </span>
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-400 max-w-xl mx-auto">{error}</p>
      )}

      <button
        onClick={onStart}
        disabled={isLoading}
        className="group relative flex justify-center items-center px-10 py-5 bg-[#18181b] border border-white/10 rounded-full hover:border-[#a855f7]/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] mx-auto cursor-pointer"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#a855f7]/20 to-[#ec4899]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <span className="relative flex items-center space-x-3 font-medium tracking-wide text-lg">
          {isLoading ? (
            <span>Generating questions...</span>
          ) : (
            <>
              <span>Start Reflection</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </span>
      </button>
      {isLoading && (
        <p className="text-xs text-[#a1a1aa] font-mono -mt-4">
          {`Waited ${waitSeconds}s`}
        </p>
      )}

      <div className="text-xs text-[#71717a]/40 mt-12 font-mono space-y-1">
        <div>{`FE ${frontendVersion} | BE ${backendVersion}`}</div>
        <div>No login | Local storage only</div>
      </div>
    </motion.div>
  );
};

export default LandingPage;
