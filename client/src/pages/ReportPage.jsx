import { RefreshCw, ChevronDown, Save, Shuffle, Users } from 'lucide-react';
import ReportSection from '../components/ReportSection';
import PersonalityCard from '../components/PersonalityCard';
import AuthPanel from '../components/AuthPanel';

const ReportPage = ({
  report,
  mirrorId,
  reportFolded,
  setReportFolded,
  onRestart,
  user,
  authMode,
  onAuthModeChange,
  onAuthSubmit,
  authLoading,
  authError,
  savedRecord,
  onSaveRecord,
  saveLoading,
  saveError,
  onToggleMatchPool,
  poolLoading,
  onRandomMatch,
  onOpenMatchDetails,
  matchLoading,
  matchError,
  latestMatch
}) => {
  const isSaved = Boolean(savedRecord?.record_id);

  return (
    <div
      key="report"
      className="w-full max-w-4xl mx-auto space-y-12 pb-20"
    >
      <div className="text-center space-y-6 animate-in slide-in-from-bottom-8 duration-700">
        <span className="text-xs font-mono text-[#fbbf24] uppercase tracking-[0.3em]">你的人格镜像</span>
        <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/60 leading-tight">
          {report.headline}
        </h1>
        <p className="text-xl md:text-2xl text-[#d4d4d8] font-light max-w-3xl mx-auto italic border-l-4 border-[#fbbf24]/50 pl-6 py-2 bg-[#18181b]/35 rounded-r-xl text-left">
          "{report.brutal_summary}"
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 md:p-7 text-left">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#34d399]">Record</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                {isSaved ? '已保存到你的时间线' : '当前结果还未进入账号历史'}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#a1a1aa]">
                {isSaved
                  ? '这份结果可以被重新打开，也能作为你发起随机匹配的基准。'
                  : user
                    ? '点击保存后，这次测试会永久保存在你的账号中。'
                    : '你可以先阅读报告，再登录或注册，把这次结果永久保存下来。'}
              </p>
            </div>
            {isSaved && (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
                <div className="text-xs text-[#71717a]">Mirror ID</div>
                <div className="mt-1 text-sm font-mono text-white">{mirrorId}</div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {user && !isSaved && (
              <button
                type="button"
                onClick={onSaveRecord}
                disabled={saveLoading}
                className="inline-flex items-center gap-2 rounded-full bg-[#34d399] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#6ee7b7] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>{saveLoading ? '保存中...' : '保存到我的历史'}</span>
              </button>
            )}

            {isSaved && (
              <>
                <button
                  type="button"
                  onClick={onToggleMatchPool}
                  disabled={poolLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm text-white transition hover:border-[#34d399]/50 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                  <Users className="h-4 w-4" />
                  <span>{poolLoading ? '更新中...' : savedRecord.is_match_enabled ? '移出匹配池' : '加入匹配池'}</span>
                </button>

                <button
                  type="button"
                  onClick={onRandomMatch}
                  disabled={matchLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-5 py-3 text-sm text-[#fef3c7] transition hover:bg-[#fbbf24]/20 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                  <Shuffle className="h-4 w-4" />
                  <span>{matchLoading ? '匹配中...' : '用最近记录随机匹配'}</span>
                </button>
              </>
            )}
          </div>

          {saveError && <p className="mt-4 text-sm text-[#fca5a5]">{saveError}</p>}
          {matchError && <p className="mt-4 text-sm text-[#fca5a5]">{matchError}</p>}

          {latestMatch && (
            <div className="mt-5 rounded-2xl border border-[#fbbf24]/20 bg-[#fbbf24]/8 px-4 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#fef3c7]">
                    已生成一份新的匹配结果，当前契合度 {latestMatch.compatibility_score}%
                  </p>
                  <p className="mt-1 text-sm text-[#d6d3d1]">
                    可查看双方类型、最舒适阶段、最不舒适阶段以及对应建议。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenMatchDetails}
                  className="inline-flex items-center justify-center rounded-full border border-[#fbbf24]/30 px-5 py-3 text-sm text-[#fef3c7] transition hover:bg-[#fbbf24]/12 cursor-pointer"
                >
                  查看完整匹配结果
                </button>
              </div>
            </div>
          )}

          {isSaved && (
            <p className="mt-4 text-sm text-[#a1a1aa]">
              当前状态：{savedRecord.is_match_enabled ? '已加入匿名匹配池，其他随机用户可能匹配到你最近一次记录。' : '未加入匿名匹配池，仅你自己可以用这份记录发起匹配。'}
            </p>
          )}
        </div>

        {!user && !isSaved && (
          <AuthPanel
            title="登录后保存这次结果"
            description="注册后会立刻把当前报告写入你的账户历史，后续每次测试也会自动保存。"
            mode={authMode}
            onModeChange={onAuthModeChange}
            onSubmit={onAuthSubmit}
            isLoading={authLoading}
            error={authError}
            submitLabels={{
              login: '登录并保存当前结果',
              register: '注册并保存当前结果'
            }}
          />
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <ReportSection title="表层人格" content={report.surface_persona} delay={100} />
        {report.shadow_analysis && (
          <ReportSection title="影子人格" content={report.shadow_analysis} delay={150} shadow />
        )}
        <ReportSection title="深层驱动" content={report.core_drives} delay={200} />
        <ReportSection title="防御机制" content={report.defense_mechanisms} isList delay={300} />
        <ReportSection title="关系模式" content={report.relationship_pattern} delay={400} />
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <button
            type="button"
            onClick={() => setReportFolded(!reportFolded)}
            className="md:col-span-2 text-center py-2 cursor-pointer text-[#71717a] hover:text-white transition-colors flex items-center justify-center space-x-2"
          >
            <span>{reportFolded ? '展开更多深度分析' : '收起深度分析'}</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${!reportFolded ? 'rotate-180' : ''}`} />
          </button>

          {!reportFolded && (
            <>
              <ReportSection title="人生模式" content={report.life_pattern} fullWidth delay={500} />
              <div className="contents md:contents">
                <ReportSection title="风险提醒" content={report.risks} isList warning delay={600} />
                <ReportSection title="成长建议" content={report.growth_advice} isList success delay={700} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center pt-16 border-t border-white/5 space-y-8">
        <h3 className="text-xl font-bold text-center">你的专属人格卡片</h3>

        <div className="relative group transform hover:scale-[1.02] transition-transform duration-500">
          <PersonalityCard report={report} mirrorId={mirrorId} />
        </div>

        <div className="flex space-x-4">
          <button onClick={onRestart} className="text-sm text-[#71717a] hover:text-white flex items-center space-x-2 transition-colors px-6 py-3 rounded-full hover:bg-white/5 cursor-pointer">
            <RefreshCw className="w-4 h-4" />
            <span>重新开始</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;
