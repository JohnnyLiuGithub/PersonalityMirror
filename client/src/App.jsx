import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { createSessionId, toMirrorId, BLUEPRINT_VERSION } from './lib/session';
import { randomizeQuestionPresentation, createSeededRng } from './lib/questionPresentation';
import { calculateScores, identifyType } from './store/scoring';
import { useSessionStore } from './store/useSessionStore';
import { FRONTEND_VERSION } from './lib/version';
import { useBackendVersion } from './hooks/useBackendVersion';
import { useWaitTimer } from './hooks/useWaitTimer';
import {
  fetchCurrentUser,
  fetchStats,
  fetchQuestionSet,
  fetchRandomMatch,
  fetchRecordDetail,
  generateReportAI,
  importRecord,
  listRecords,
  loginUser,
  logoutUser,
  registerUser,
  setRecordMatchEnabled
} from './lib/backendClient';

import LandingPage from './pages/LandingPage';
import QuestionPage from './pages/QuestionPage';
import LoadingPage from './pages/LoadingPage';
import ReportPage from './pages/ReportPage';
import MatchResultModal from './components/MatchResultModal';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const upsertRecord = (records, nextRecord) => {
  if (!nextRecord?.record_id) {
    return records;
  }

  const merged = [nextRecord, ...records.filter((item) => item.record_id !== nextRecord.record_id)];
  return merged.sort((left, right) => (right.created_at || 0) - (left.created_at || 0));
};

const buildShortAnswers = (questions, answers) => questions
  .filter((question) => question.type === 'short')
  .map((question) => ({
    question_id: question.id,
    text: typeof answers?.[question.id] === 'string' ? answers[question.id].trim() : ''
  }))
  .filter((item) => item.text);

function App() {
  const { state, patch, clearSession, setState } = useSessionStore();
  const backendVersion = useBackendVersion();
  const { waitSeconds, start: startWaitTimer, stop: stopWaitTimer } = useWaitTimer();
  const [authMode, setAuthMode] = useState('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [poolLoading, setPoolLoading] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState(null);
  const [matchModalOpen, setMatchModalOpen] = useState(false);

  const {
    user,
    authToken,
    records,
    recordsLoaded,
    recordsError,
    globalStats,
    userStats,
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
    error,
    savedRecordId,
    latestMatch
  } = state;

  const currentQuestion = questions[currentQuestionIndex];
  const progress = useMemo(() => (
    questions.length > 0 ? (currentQuestionIndex / questions.length) * 100 : 0
  ), [currentQuestionIndex, questions.length]);
  const mirrorId = useMemo(() => toMirrorId(sessionId || savedRecordId), [savedRecordId, sessionId]);
  const savedRecord = useMemo(() => records.find((item) => item.record_id === savedRecordId) || null, [records, savedRecordId]);

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

  const loadStats = useCallback(async (tokenOverride = authToken) => {
    try {
      const payload = await fetchStats(tokenOverride || undefined);
      patch({
        globalStats: payload?.global_stats || null,
        userStats: payload?.user_stats || null
      });
      return payload;
    } catch {
      return null;
    }
  }, [authToken, patch]);

  const loadRecords = useCallback(async (tokenOverride = authToken) => {
    if (!tokenOverride) {
      return [];
    }

    setRecordsLoading(true);
    try {
      const payload = await listRecords(tokenOverride);
      patch({
        records: Array.isArray(payload.records) ? payload.records : [],
        recordsLoaded: true,
        recordsError: null
      });
      return Array.isArray(payload.records) ? payload.records : [];
    } catch (err) {
      patch({
        records: [],
        recordsLoaded: true,
        recordsError: err instanceof Error ? err.message : '历史记录加载失败'
      });
      return [];
    } finally {
      setRecordsLoading(false);
    }
  }, [authToken, patch]);

  const buildRecordPayload = useCallback(() => {
    if (!report || !questions.length || !state.scores || !state.types) {
      throw new Error('当前结果还不完整，无法保存');
    }

    return {
      session_id: sessionId,
      questions,
      answers,
      scores: state.scores,
      main_type: state.types.main,
      shadow_type: state.types.shadow,
      short_answers: buildShortAnswers(questions, answers),
      report,
      blueprint_version: BLUEPRINT_VERSION
    };
  }, [answers, questions, report, sessionId, state.scores, state.types]);

  const saveCurrentRecord = useCallback(async (tokenOverride = authToken) => {
    const payload = buildRecordPayload();
    const response = await importRecord(tokenOverride, payload);
    const nextRecord = response.record;
    patch({
      savedRecordId: nextRecord?.record_id || null,
      records: upsertRecord(state.records, nextRecord),
      recordsLoaded: true,
      latestMatch: null
    });
    return nextRecord;
  }, [authToken, buildRecordPayload, patch, state.records]);

  useEffect(() => {
    if (!authToken || user) {
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const payload = await fetchCurrentUser(authToken);
        if (cancelled) {
          return;
        }
        patch({ user: payload.user, userStats: payload.user_stats || null });
      } catch {
        if (cancelled) {
          return;
        }
        setAuthError('登录状态已失效，请重新登录。');
        clearSession({ preserveAuth: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authToken, clearSession, patch, user]);

  useEffect(() => {
    if (!authToken || !user || recordsLoaded || recordsLoading) {
      return;
    }
    loadRecords(authToken);
  }, [authToken, loadRecords, recordsLoaded, recordsLoading, user]);

  useEffect(() => {
    loadStats(authToken || null);
  }, [authToken, loadStats]);

  useEffect(() => {
    if (!latestMatch?.match_id) {
      return;
    }
    setMatchModalOpen(true);
  }, [latestMatch?.match_id]);

  const handleAuthSubmit = useCallback(async (mode, form) => {
    setAuthLoading(true);
    setAuthError(null);

    try {
      const payload = mode === 'register'
        ? await registerUser(form)
        : await loginUser(form);

      patch({
        user: payload.user,
        authToken: payload.token,
        records: [],
        recordsLoaded: false,
        recordsError: null,
        userStats: null
      });

      await loadStats(payload.token);
      const history = await loadRecords(payload.token);
      if (view === 'report' && report && !savedRecordId) {
        const saved = await saveCurrentRecord(payload.token);
        patch({ records: upsertRecord(history, saved) });
      }
      await loadStats(payload.token);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '认证失败，请重试。');
    } finally {
      setAuthLoading(false);
    }
  }, [loadRecords, loadStats, patch, report, saveCurrentRecord, savedRecordId, view]);

  const handleLogout = useCallback(async () => {
    try {
      if (authToken) {
        await logoutUser(authToken);
      }
    } catch {
      // Best effort only.
    } finally {
      setAuthError(null);
      setSaveError(null);
      setMatchError(null);
      setMatchModalOpen(false);
      clearSession({ preserveAuth: false });
      loadStats(null);
    }
  }, [authToken, clearSession, loadStats]);

  const startSession = useCallback(async () => {
    const newSessionId = createSessionId();

    startWaitTimer();
    patch({
      sessionId: newSessionId,
      isLoading: true,
      loadingStep: 'questions',
      loadingMessage: 'Generating your question set...',
      error: null,
      savedRecordId: null,
      latestMatch: null
    });

    try {
      const generated = await fetchQuestionSet(newSessionId);

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
        error: null,
        savedRecordId: null,
        latestMatch: null
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
        error: err instanceof Error ? err.message : 'AI question generation failed. Please retry.',
        savedRecordId: null,
        latestMatch: null
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
      const generated = await Promise.all([
        generateReportAI({
          token: authToken,
          sessionId,
          scores: scoringResult.scores,
          typeObj,
          evidence: scoringResult.evidence,
          shortAnswers: scoringResult.short_answers,
          questions,
          answers: finalAnswers,
          blueprintVersion: BLUEPRINT_VERSION
        }),
        sleep(1200)
      ]).then(([result]) => result);

      patch({
        report: generated.report,
        reportFolded: true,
        loadingStep: 'card',
        loadingMessage: 'Preparing share card...',
        view: 'report',
        error: null,
        savedRecordId: generated.record?.record_id || null,
        latestMatch: null
      });

      loadStats(authToken);

      if (generated.record) {
        patch({
          records: upsertRecord(state.records, generated.record),
          recordsLoaded: true,
          recordsError: null
        });
      }
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
  }, [authToken, loadStats, patch, questions, resetWaitState, sessionId, startWaitTimer, state.records]);

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
      setSaveError(null);
      setMatchError(null);
      setMatchModalOpen(false);
      resetWaitState();
      clearSession({ preserveAuth: true });
    }
  }, [clearSession, resetWaitState]);

  const handleOpenRecord = useCallback(async (recordId) => {
    if (!authToken) {
      return;
    }

    try {
      const payload = await fetchRecordDetail(authToken, recordId);
      const record = payload.record;
      setSaveError(null);
      setMatchError(null);
      setState((prev) => ({
        ...prev,
        sessionId: record.session_id || prev.sessionId || createSessionId(),
        view: 'report',
        questions: Array.isArray(record.questions) ? record.questions : [],
        currentQuestionIndex: 0,
        answers: record.answers || {},
        localAnswer: null,
        isLoading: false,
        loadingStep: '',
        loadingMessage: '',
        report: record.report || null,
        reportFolded: true,
        scores: record.scores || null,
        types: { main: record.main_type || null, shadow: record.shadow_type || null },
        error: null,
        savedRecordId: record.record_id,
        latestMatch: null
      }));
      setMatchModalOpen(false);
    } catch (err) {
      patch({
        recordsError: err instanceof Error ? err.message : '读取记录失败'
      });
    }
  }, [authToken, patch, setState]);

  const handleSaveRecord = useCallback(async () => {
    setSaveLoading(true);
    setSaveError(null);

    try {
      await saveCurrentRecord(authToken);
      await loadStats(authToken);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaveLoading(false);
    }
  }, [authToken, loadStats, saveCurrentRecord]);

  const handleToggleMatchPool = useCallback(async () => {
    if (!authToken || !savedRecord) {
      return;
    }

    setPoolLoading(true);
    setMatchError(null);

    try {
      const payload = await setRecordMatchEnabled(authToken, savedRecord.record_id, !savedRecord.is_match_enabled);
      patch({
        records: upsertRecord(state.records, payload.record),
        recordsLoaded: true
      });
      await loadStats(authToken);
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : '匹配池设置失败');
    } finally {
      setPoolLoading(false);
    }
  }, [authToken, loadStats, patch, savedRecord, state.records]);

  const handleRandomMatch = useCallback(async () => {
    if (!authToken || !savedRecordId) {
      return;
    }

    setMatchLoading(true);
    setMatchError(null);

    try {
      const match = await fetchRandomMatch(authToken, savedRecordId);
      patch({ latestMatch: match });
      await loadStats(authToken);
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : '随机匹配失败');
    } finally {
      setMatchLoading(false);
    }
  }, [authToken, loadStats, patch, savedRecordId]);

  return (
    <div className="w-full max-w-6xl px-4 py-8 relative z-10 mx-auto min-h-screen flex flex-col">
      <div className="fixed top-0 left-1/6 w-[28rem] h-[28rem] bg-[#fbbf24]/10 rounded-full blur-[140px] -z-10 pointer-events-none"></div>
      <div className="fixed bottom-0 right-1/6 w-[26rem] h-[26rem] bg-[#34d399]/10 rounded-full blur-[140px] -z-10 pointer-events-none"></div>

      {view !== 'landing' && (
        <header className="fixed top-0 left-0 right-0 p-4 flex justify-between items-center bg-[#09090b]/80 backdrop-blur-md z-50 border-b border-white/5">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={confirmRestart}>
            <div className="w-2 h-8 bg-gradient-to-b from-[#fbbf24] to-[#34d399] rounded-full"></div>
            <span className="font-bold tracking-tight text-lg">Personality Mirror</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-[#a1a1aa]">
            {user && <span>{user.username}</span>}
            {view === 'question' && <span>{`Q ${currentQuestionIndex + 1} / ${questions.length}`}</span>}
          </div>
        </header>
      )}

      <main className="mt-16 md:mt-8 flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {view === 'landing' && (
            <LandingPage
              onStart={startSession}
              isLoading={isLoading}
              waitSeconds={waitSeconds}
              frontendVersion={FRONTEND_VERSION}
              backendVersion={backendVersion}
              error={error}
              user={user}
              globalStats={globalStats}
              userStats={userStats}
              records={records}
              recordsLoading={recordsLoading}
              recordsError={recordsError}
              onOpenRecord={handleOpenRecord}
              onLogout={handleLogout}
              authMode={authMode}
              onAuthModeChange={setAuthMode}
              onAuthSubmit={handleAuthSubmit}
              authLoading={authLoading}
              authError={authError}
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
              onRestart={() => clearSession({ preserveAuth: true })}
              user={user}
              authMode={authMode}
              onAuthModeChange={setAuthMode}
              onAuthSubmit={handleAuthSubmit}
              authLoading={authLoading}
              authError={authError}
              savedRecord={savedRecord}
              onSaveRecord={handleSaveRecord}
              saveLoading={saveLoading}
              saveError={saveError}
              onToggleMatchPool={handleToggleMatchPool}
              poolLoading={poolLoading}
              onRandomMatch={handleRandomMatch}
              onOpenMatchDetails={() => setMatchModalOpen(true)}
              matchLoading={matchLoading}
              matchError={matchError}
              latestMatch={latestMatch}
            />
          )}
        </AnimatePresence>
      </main>

      <MatchResultModal
        match={latestMatch}
        open={matchModalOpen}
        onClose={() => setMatchModalOpen(false)}
      />
    </div>
  );
}

export default App;

