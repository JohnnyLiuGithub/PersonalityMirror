import { X, Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react';

const ListBlock = ({ title, items, tone = 'neutral' }) => {
  const toneClass = tone === 'warning'
    ? 'border-[#f59e0b]/20 bg-[#2a1608]/70 text-[#fde68a]'
    : 'border-[#34d399]/20 bg-[#0d1f1a]/70 text-[#d1fae5]';

  return (
    <div className={`rounded-[24px] border p-5 ${toneClass}`}>
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <div className="mt-3 space-y-2 text-sm leading-6">
        {items.map((item) => <p key={item}>- {item}</p>)}
      </div>
    </div>
  );
};

const ProfileCard = ({ title, profile, accent }) => (
  <div className={`rounded-[24px] border p-5 ${accent}`}>
    <p className="text-xs uppercase tracking-[0.3em] text-[#a1a1aa]">{title}</p>
    <h4 className="mt-3 text-2xl font-semibold text-white">{profile?.main_label || '类型待定'}</h4>
    <p className="mt-2 text-sm text-[#d4d4d8]">{profile?.headline || '暂无概述'}</p>
    {profile?.shadow_label && (
      <p className="mt-3 text-xs text-[#71717a]">影子类型：{profile.shadow_label}</p>
    )}
  </div>
);

const MatchResultModal = ({ match, open, onClose }) => {
  if (!open || !match?.report) {
    return null;
  }

  const { compatibility_score: score, report, source, partner } = match;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md">
      <div className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[36px] border border-white/10 bg-[linear-gradient(160deg,rgba(32,22,16,0.96),rgba(9,9,11,0.98))] p-6 md:p-8 shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#d4d4d8] transition hover:bg-white/10 hover:text-white cursor-pointer"
          aria-label="关闭匹配结果"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="pr-12">
          <p className="text-xs uppercase tracking-[0.35em] text-[#fbbf24]">Match Result</p>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-semibold text-white md:text-4xl">匿名匹配契合度 {score}%</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#d4d4d8]">{report.summary}</p>
            </div>
            <div className="rounded-[24px] border border-[#fbbf24]/20 bg-[#2a1a0c]/70 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.25em] text-[#fbbf24]">总评</p>
              <p className="mt-2 text-sm leading-6 text-[#fef3c7]">{report.joint_advice}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <ProfileCard title="我是这种互动风格" profile={source} accent="border-white/10 bg-white/[0.04]" />
          <ProfileCard title="对方是这种互动风格" profile={partner} accent="border-white/10 bg-white/[0.04]" />
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.02fr_0.98fr]">
          <section className="rounded-[28px] border border-[#34d399]/15 bg-[#081311]/80 p-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-[#34d399]" />
              <h3 className="text-xl font-semibold text-white">我们最舒服的情况</h3>
            </div>
            <div className="mt-5">
              <ListBlock title="舒服的互动场景" items={report.comfortable_moments} />
            </div>
            <div className="mt-5 rounded-[24px] border border-white/8 bg-black/20 p-5">
              <h4 className="text-sm font-semibold text-white">为什么会舒服</h4>
              <p className="mt-3 text-sm leading-7 text-[#d4d4d8]">{report.comfortable_reason}</p>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#f59e0b]/15 bg-[#161007]/85 p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-[#f59e0b]" />
              <h3 className="text-xl font-semibold text-white">我们最不舒服的情况</h3>
            </div>
            <div className="mt-5">
              <ListBlock title="容易摩擦的互动场景" items={report.uncomfortable_moments} tone="warning" />
            </div>
            <div className="mt-5 rounded-[24px] border border-white/8 bg-black/20 p-5">
              <h4 className="text-sm font-semibold text-white">为什么会卡住</h4>
              <p className="mt-3 text-sm leading-7 text-[#d4d4d8]">{report.uncomfortable_reason}</p>
            </div>
            <div className="mt-5 rounded-[24px] border border-[#fbbf24]/15 bg-[#fbbf24]/8 p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-[#fbbf24]" />
                <h4 className="text-sm font-semibold text-white">怎么做</h4>
              </div>
              <p className="mt-3 text-sm leading-7 text-[#fef3c7]">{report.what_to_do}</p>
            </div>
          </section>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-white/8 bg-black/20 p-5">
            <h4 className="text-sm font-semibold text-white">给我的建议</h4>
            <div className="mt-3 space-y-2 text-sm leading-6 text-[#d4d4d8]">
              {report.advice_for_you.map((item) => <p key={item}>- {item}</p>)}
            </div>
          </div>
          <div className="rounded-[24px] border border-white/8 bg-black/20 p-5">
            <h4 className="text-sm font-semibold text-white">给对方的建议</h4>
            <div className="mt-3 space-y-2 text-sm leading-6 text-[#d4d4d8]">
              {report.advice_for_them.map((item) => <p key={item}>- {item}</p>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchResultModal;
