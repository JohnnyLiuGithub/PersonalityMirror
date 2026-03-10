import { useCallback, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { createSessionId, toMirrorId } from './lib/session';
import { randomizeQuestionPresentation, createSeededRng } from './lib/questionPresentation';
import { calculateScores, identifyType } from './store/scoring';
import { generateQuestionsAI, generateReportAI } from './store/ai';
import { useSessionStore } from './store/useSessionStore';
import { FRONTEND_VERSION } from './lib/version';
import { useBackendVersion } from './hooks/useBackendVersion';
import { useWaitTimer } from './hooks/useWaitTimer';

import LandingPage from './pages/LandingPage';
import QuestionPage from './pages/QuestionPage';
import LoadingPage from './pages/LoadingPage';
import ReportPage from './pages/ReportPage';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function App() {
  const { state, patch, clearSession } = useSessionStore();
  const backendVersion = useBackendVersion();
  const { waitSeconds, start: startWaitTimer, stop: stopWaitTimer } = useWaitTimer();

  const {
    sessionId,
    view,
    questions,
    currentQuestionIndex,
    answers,
    localAnswer,
    isLoading,
    loadingStep,
    loadingMessage,
    report,
    reportFolded,
    error
  } = state;

  const currentQuestion = questions[currentQuestionIndex];

  const progress = useMemo(() => (
    questions.length > 0 ? (currentQuestionIndex / questions.length) * 100 : 0
  ), [currentQuestionIndex, questions.length]);

  const mirrorId = useMemo(() => toMirrorId(sessionId), [sessionId]);

  const isAnswerValid = useMemo(() => {
    if (!currentQuestion) return false;
    if (currentQuestion.type === 'mcq') return Boolean(localAnswer);
    if (currentQuestion.type === 'rank') return Array.isArray(localAnswer) && localAnswer.length === currentQuestion.rank_items.length;
    if (currentQuestion.type === 'short') return typeof localAnswer === 'string' && localAnswer.trim().length >= 10;
    return false;
  }, [currentQuestion, localAnswer]);

  const resetWaitState = useCallback(() => {
    stopWaitTimer();
  }, [stopWaitTimer]);

  const startSession = useCallback(async () => {
    const newSessionId = createSessionId();

    startWaitTimer();
    patch({
      sessionId: newSessionId,
      isLoading: true,
      loadingStep: 'questions',
      loadingMessage: 'Generating your question set...',
      error: null
    });

    try {
      const generated = await Promise.all([
        generateQuestionsAI(newSessionId),
        sleep(900)
      ]).then(([result]) => result);

      const randomizedQuestions = randomizeQuestionPresentation(generated, createSeededRng(newSessionId));

      patch({
        sessionId: newSessionId,
        view: 'question',
        questions: randomizedQuestions,
        currentQuestionIndex: 0,
        answers: {},
        localAnswer: null,
        isLoading: false,
        loadingStep: '',
        loadingMessage: '',
        report: null,
        reportFolded: true,
        scores: null,
        types: null,
        error: null
      });
    } catch (err) {
      patch({
        sessionId: null,
        view: 'landing',
        questions: [],
        currentQuestionIndex: 0,
        answers: {},
        localAnswer: null,
        isLoading: false,
        loadingStep: '',
        loadingMessage: '',
        report: null,
        scores: null,
        types: null,
        error: err instanceof Error ? err.message : 'AI question generation failed. Please retry.'
      });
    } finally {
      resetWaitState();
    }
  }, [patch, resetWaitState, startWaitTimer]);

  const finishSession = useCallback(async (finalAnswers) => {
    startWaitTimer();
    patch({
      view: 'loading',
      loadingStep: 'scoring',
      loadingMessage: 'Scoring six personality dimensions...',
      error: null
    });

    const scoringResult = calculateScores(questions, finalAnswers);
    const typeObj = identifyType(scoringResult.scores);

    patch({
      scores: scoringResult.scores,
      types: typeObj,
      loadingStep: 'analysis',
      loadingMessage: 'Generating personality analysis...'
    });

    try {
      await sleep(500);
      const generatedReport = await Promise.all([
        generateReportAI({
          sessionId,
          scores: scoringResult.scores,
          typeObj,
          evidence: scoringResult.evidence,
          shortAnswers: scoringResult.short_answers
        }),
        sleep(1200)
      ]).then(([result]) => result);

      patch({
        report: generatedReport,
        reportFolded: true,
        loadingStep: 'card',
        loadingMessage: 'Preparing share card...',
        view: 'report',
        error: null
      });
    } catch (err) {
      patch({
        view: 'question',
        currentQuestionIndex: Math.max(questions.length - 1, 0),
        localAnswer: finalAnswers[questions[questions.length - 1]?.id] ?? null,
        isLoading: false,
        loadingStep: '',
        loadingMessage: '',
        error: err instanceof Error ? err.message : 'AI report generation failed. Please retry.'
      });
    } finally {
      resetWaitState();
    }
  }, [patch, questions, resetWaitState, sessionId, startWaitTimer]);

  const nextQuestion = useCallback(() => {
    if (!currentQuestion) {
      return;
    }

    const nextAnswers = {
      ...answers,
      [currentQuestion.id]: localAnswer
    };

    if (currentQuestionIndex < questions.length - 1) {
      const nextQuestionId = questions[currentQuestionIndex + 1]?.id;
      patch({
        answers: nextAnswers,
        currentQuestionIndex: currentQuestionIndex + 1,
        localAnswer: nextQuestionId ? nextAnswers[nextQuestionId] ?? null : null
      });
      return;
    }

    patch({ answers: nextAnswers });
    finishSession(nextAnswers);
  }, [answers, currentQuestion, currentQuestionIndex, finishSession, localAnswer, patch, questions]);

  const selectOption = useCallback((option) => {
    patch({ localAnswer: option });
  }, [patch]);

  const selectRankItem = useCallback((item) => {
    const current = Array.isArray(localAnswer) ? localAnswer : [];
    if (!current.includes(item)) {
      patch({ localAnswer: [...current, item] });
    }
  }, [localAnswer, patch]);

  const deselectRankItem = useCallback((item) => {
    const current = Array.isArray(localAnswer) ? localAnswer : [];
    patch({ localAnswer: current.filter((value) => value !== item) });
  }, [localAnswer, patch]);

  const getRemainingRankItems = useCallback(() => {
    if (!currentQuestion || currentQuestion.type !== 'rank') return [];
    const selected = Array.isArray(localAnswer) ? localAnswer : [];
    return currentQuestion.rank_items.filter((item) => !selected.includes(item));
  }, [currentQuestion, localAnswer]);

  const confirmRestart = useCallback(() => {
    if (window.confirm('Restart and clear current progress?')) {
      resetWaitState();
      clearSession();
    }
  }, [clearSession, resetWaitState]);

  return (
    <div className="w-full max-w-4xl px-4 py-8 relative z-10 mx-auto min-h-screen flex flex-col">
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-[#a855f7]/10 rounded-full blur-[120px] -z-10 animate-pulse pointer-events-none"></div>
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-[#ec4899]/10 rounded-full blur-[120px] -z-10 animate-pulse pointer-events-none delay-1000"></div>

      {view !== 'landing' && (
        <header className="fixed top-0 left-0 right-0 p-4 flex justify-between items-center bg-[#09090b]/80 backdrop-blur-md z-50 border-b border-white/5">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={confirmRestart}>
            <div className="w-2 h-8 bg-gradient-to-b from-[#a855f7] to-[#ec4899] rounded-full"></div>
            <span className="font-bold tracking-tight text-lg">Personality Mirror</span>
          </div>
          {view === 'question' && (
            <div className="text-xs font-mono text-[#71717a]">
              Q {currentQuestionIndex + 1} / {questions.length}
            </div>
          )}
        </header>
      )}

      <main className="mt-16 md:mt-0 flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {view === 'landing' && (
            <LandingPage
              onStart={startSession}
              isLoading={isLoading}
              waitSeconds={waitSeconds}
              frontendVersion={FRONTEND_VERSION}
              backendVersion={backendVersion}
              error={error}
            />
          )}

          {view === 'question' && currentQuestion && (
            <QuestionPage
              currentQuestion={currentQuestion}
              currentQuestionIndex={currentQuestionIndex}
              totalQuestions={questions.length}
              localAnswer={localAnswer}
              progress={progress}
              onSelectOption={selectOption}
              onSelectRankItem={selectRankItem}
              onDeselectRankItem={deselectRankItem}
              onShortAnswerChange={(value) => patch({ localAnswer: value })}
              onNext={nextQuestion}
              isAnswerValid={isAnswerValid}
              getRemainingRankItems={getRemainingRankItems}
            />
          )}

          {view === 'loading' && (
            <LoadingPage loadingMessage={loadingMessage} loadingStep={loadingStep} waitSeconds={waitSeconds} />
          )}

          {view === 'report' && report && (
            <ReportPage
              report={report}
              mirrorId={mirrorId}
              reportFolded={reportFolded}
              setReportFolded={(value) => patch({ reportFolded: value })}
              onRestart={clearSession}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
