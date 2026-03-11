import { ArrowRight } from 'lucide-react';
import AuthPanel from '../components/AuthPanel';
import HistoryPanel from '../components/HistoryPanel';

const LandingPage = ({
  onStart,
  isLoading,
  waitSeconds,
  frontendVersion,
  backendVersion,
  error,
  user,
  globalStats,
  userStats,
  records,
  recordsLoading,
  recordsError,
  onOpenRecord,
  onLogout,
  authMode,
  onAuthModeChange,
  onAuthSubmit,
  authLoading,
  authError
}) => {
  const heroDescription = user
    ? '继续以登录状态测试，新报告会自动进入你的历史时间线，并可加入匿名随机匹配。'
    : '先以游客身份直接测试，或者注册后保存多次记录并参与匿名随机匹配。';

  return (
    <div
      key="landing"
      className="space-y-10"
    >
      <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] items-start">
        <div className="space-y-8 rounded-[36px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.2),transparent_38%),linear-gradient(140deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-8 md:p-10 text-left shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.45em] text-[#fbbf24]">Personality Mirror</p>
            <h1 className="max-w-3xl text-5xl md:text-7xl font-semibold tracking-[-0.04em] text-white">
              不登录也能开始。
              <br />
              登录后，结果会留下来。
            </h1>
            <p className="max-w-2xl text-base md:text-lg leading-8 text-[#d4d4d8]">
              {heroDescription}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-[#a1a1aa]">Mode</p>
              <p className="mt-2 text-lg text-white">游客直接测试</p>
              <p className="mt-2 text-sm leading-6 text-[#71717a]">不拦登录，先完成 12 题再决定是否保存。</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-[#a1a1aa]">Archive</p>
              <p className="mt-2 text-lg text-white">多次记录时间线</p>
              <p className="mt-2 text-sm leading-6 text-[#71717a]">每次测试独立保存，可回看最近一次和历史差异。</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-[#a1a1aa]">Match</p>
              <p className="mt-2 text-lg text-white">匿名随机匹配</p>
              <p className="mt-2 text-sm leading-6 text-[#71717a]">基于双方最近一次记录计算契合度，并由 AI 给出互动建议。</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#fbbf24]/15 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-[#a1a1aa]">All Reports</p>
              <p className="mt-2 text-3xl font-semibold text-white">{globalStats?.total_tests ?? 0}</p>
              <p className="mt-2 text-sm leading-6 text-[#71717a]">产品累计完成并生成报告的测试次数。</p>
            </div>
            <div className="rounded-2xl border border-[#34d399]/15 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-[#a1a1aa]">All Matches</p>
              <p className="mt-2 text-3xl font-semibold text-white">{globalStats?.total_matches ?? 0}</p>
              <p className="mt-2 text-sm leading-6 text-[#71717a]">产品累计成功生成的匿名匹配次数。</p>
            </div>
          </div>

          {error && <p className="text-sm text-[#fca5a5]">{error}</p>}

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={onStart}
              disabled={isLoading}
              className="group inline-flex items-center gap-3 rounded-full bg-[#fbbf24] px-8 py-4 text-base font-semibold text-black transition hover:bg-[#fcd34d] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              <span>{isLoading ? '正在生成问题...' : user ? '开始并自动保存' : '游客直接开始'}</span>
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </button>
            <p className="text-sm text-[#a1a1aa]">
              {isLoading ? `已等待 ${waitSeconds}s` : '测试完成后可查看人格报告与匹配建议'}
            </p>
          </div>

          <div className="text-xs text-[#71717a]/70 font-mono space-y-1">
            <div>{`FE ${frontendVersion} | BE ${backendVersion}`}</div>
            <div>{user ? 'Auto-save enabled for signed-in users' : 'Guest mode enabled, local session resume supported'}</div>
          </div>
        </div>

        {user ? (
          <HistoryPanel
            user={user}
            records={records}
            userStats={userStats}
            onOpenRecord={onOpenRecord}
            onLogout={onLogout}
            isLoading={recordsLoading}
            error={recordsError}
          />
        ) : (
          <AuthPanel
            title="注册后永久保存"
            description="注册后，当前和后续的测试记录都会进入账号历史；完成测试后也可以立刻补注册并保存当前结果。"
            mode={authMode}
            onModeChange={onAuthModeChange}
            onSubmit={onAuthSubmit}
            isLoading={authLoading}
            error={authError}
            submitLabels={{
              login: '登录并继续',
              register: '注册账号'
            }}
          />
        )}
      </section>
    </div>
  );
};

export default LandingPage;
