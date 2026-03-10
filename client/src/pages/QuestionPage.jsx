import { ArrowRight, X } from 'lucide-react';
import { motion } from 'framer-motion';

const QuestionPage = ({
  currentQuestion,
  currentQuestionIndex,
  totalQuestions,
  localAnswer,
  progress,
  onSelectOption,
  onSelectRankItem,
  onDeselectRankItem,
  onShortAnswerChange,
  onNext,
  isAnswerValid,
  getRemainingRankItems
}) => {
  const shortLength = typeof localAnswer === 'string' ? localAnswer.trim().length : 0;

  return (
    <motion.div
      key="question"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-2xl mx-auto space-y-8"
    >
      <div className="w-full h-1 bg-[#18181b] rounded-full overflow-hidden mb-8">
        <div
          className="h-full bg-gradient-to-r from-[#a855f7] to-[#ec4899] transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="space-y-7">
        <div className="space-y-3">
          <span className="text-xs font-mono text-[#a855f7] uppercase tracking-wider bg-[#a855f7]/10 px-2 py-1 rounded">
            {currentQuestion.type.toUpperCase()}
          </span>
          {currentQuestion.scenario && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-base md:text-lg text-[#d4d4d8] leading-relaxed">
                {currentQuestion.scenario}
              </p>
            </div>
          )}
          <h2 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight">{currentQuestion.question_text}</h2>
        </div>

        {currentQuestion.type === 'mcq' && (
          <div className="grid grid-cols-1 gap-4">
            {currentQuestion.options.map((option, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isSelected = localAnswer === letter;
              return (
                <button
                  key={letter}
                  onClick={() => onSelectOption(letter)}
                  className={`group flex items-center p-5 rounded-xl border transition-all duration-200 text-left relative overflow-hidden cursor-pointer
                    ${isSelected
                      ? 'border-[#a855f7] bg-[#a855f7]/10 text-white shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                      : 'border-white/5 bg-[#18181b] hover:bg-white/5 hover:border-white/10'
                    }`}
                >
                  <span
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold mr-4 transition-colors shrink-0
                      ${isSelected
                        ? 'bg-[#a855f7] text-white'
                        : 'bg-white/10 text-[#71717a] group-hover:bg-white/20'
                      }`}
                  >
                    {letter}
                  </span>
                  <span className="flex-1 text-lg">{option}</span>
                </button>
              );
            })}
          </div>
        )}

        {currentQuestion.type === 'rank' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#71717a] uppercase">Your Ranking (tap to remove)</label>
              <div
                className={`flex flex-col gap-2 min-h-[120px] p-4 bg-[#18181b]/50 rounded-xl border border-white/5 border-dashed transition-all
                ${Array.isArray(localAnswer) && localAnswer.length > 0 ? 'border-[#a855f7]/30 bg-[#a855f7]/5' : ''}`}
              >
                {(!Array.isArray(localAnswer) || localAnswer.length === 0) && (
                  <div className="text-center text-[#71717a]/50 py-8 text-sm italic">Pick items below in order</div>
                )}
                {Array.isArray(localAnswer) && localAnswer.map((item, idx) => (
                  <motion.button
                    layout
                    key={item}
                    onClick={() => onDeselectRankItem(item)}
                    className="flex items-center p-3 bg-[#a855f7]/20 border border-[#a855f7]/30 rounded-lg text-left group hover:bg-red-500/20 hover:border-red-500/30 transition-all cursor-pointer"
                  >
                    <span className="w-6 h-6 flex items-center justify-center bg-[#a855f7] text-white rounded-full text-xs font-bold mr-3 group-hover:bg-red-500 transition-colors">
                      {idx + 1}
                    </span>
                    <span className="flex-1 font-medium">{item}</span>
                    <X className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-red-400" />
                  </motion.button>
                ))}
                {Array.isArray(localAnswer) && localAnswer.length > 0 && localAnswer.length < 4 && (
                  <div className="text-center text-[#a855f7]/80 py-2 text-sm font-bold animate-pulse">
                    {`Still ${4 - localAnswer.length} item(s) to rank`}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#71717a] uppercase">Available Items</label>
              <div className="grid grid-cols-1 gap-2">
                {getRemainingRankItems().map((item) => (
                  <button
                    key={item}
                    onClick={() => onSelectRankItem(item)}
                    className="flex items-center p-4 bg-[#18181b] border border-white/5 rounded-lg text-left hover:bg-white/5 hover:border-white/10 transition-colors active:scale-[0.99] cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-full border border-white/20 mr-3 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white opacity-0"></div>
                    </div>
                    <span className="text-[#71717a]/80 text-lg">{item}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentQuestion.type === 'short' && (
          <div className="space-y-4">
            <textarea
              value={localAnswer || ''}
              onChange={(e) => onShortAnswerChange(e.target.value)}
              placeholder="Write your answer here..."
              className="w-full min-h-[200px] bg-[#18181b] border border-white/10 rounded-xl p-6 text-lg focus:outline-none focus:border-[#a855f7]/50 focus:ring-1 focus:ring-[#a855f7]/50 transition-all resize-none placeholder:text-[#71717a]/30 text-white"
            ></textarea>
            {currentQuestion.answer_hint && (
              <p className="text-sm text-[#a855f7]/70 text-right italic">
                Hint: {currentQuestion.answer_hint}
              </p>
            )}
            {shortLength > 0 && shortLength < 10 && (
              <p className="text-sm text-amber-400 text-right">Too short, at least 10 characters is recommended.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-8">
        <button
          onClick={onNext}
          disabled={!isAnswerValid}
          className="flex items-center space-x-2 px-8 py-3 rounded-full bg-white text-black font-bold hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 cursor-pointer"
        >
          <span>{currentQuestionIndex === totalQuestions - 1 ? 'Finish' : 'Next'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

export default QuestionPage;



