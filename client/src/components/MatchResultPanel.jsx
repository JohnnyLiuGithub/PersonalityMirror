const MatchResultPanel = ({ match }) => {
  if (!match?.report) {
    return null;
  }

  const { report, compatibility_score: score, partner } = match;

  return (
    <section className="rounded-[28px] border border-[#fbbf24]/20 bg-gradient-to-br from-[#22140a] via-[#17110b] to-[#0f0f10] p-6 md:p-8 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[#fbbf24]">Random Match</p>
          <h3 className="text-2xl font-semibold text-white">匿名匹配契合度 {score}%</h3>
          <p className="text-sm leading-6 text-[#d6d3d1]">{report.summary || '系统根据双方最近一次测试结果生成了这份互动预测。'}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-[#e7e5e4]">
          <div>{partner?.headline || '匿名对象'}</div>
          <div className="mt-1 text-xs text-[#a8a29e]">{[partner?.main_label, partner?.shadow_label].filter(Boolean).join(' / ')}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
          <h4 className="text-sm font-semibold text-white">最舒服的互动阶段</h4>
          <div className="mt-3 space-y-2 text-sm text-[#d4d4d8]">
            {report.comfortable_moments.map((item) => <p key={item}>- {item}</p>)}
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
          <h4 className="text-sm font-semibold text-white">最容易摩擦的互动阶段</h4>
          <div className="mt-3 space-y-2 text-sm text-[#f5d0fe]">
            {report.uncomfortable_moments.map((item) => <p key={item}>- {item}</p>)}
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
          <h4 className="text-sm font-semibold text-white">给你的建议</h4>
          <div className="mt-3 space-y-2 text-sm text-[#d4d4d8]">
            {report.advice_for_you.map((item) => <p key={item}>- {item}</p>)}
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
          <h4 className="text-sm font-semibold text-white">给对方的建议</h4>
          <div className="mt-3 space-y-2 text-sm text-[#d4d4d8]">
            {report.advice_for_them.map((item) => <p key={item}>- {item}</p>)}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#fbbf24]/15 bg-[#fbbf24]/6 p-4 text-sm leading-6 text-[#fef3c7]">
        {report.joint_advice}
      </div>
    </section>
  );
};

export default MatchResultPanel;
