const formatDateTime = (value) => {
  if (!value) {
    return '未知时间';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value * 1000));
};

const StatPill = ({ label, value }) => (
  <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
    <p className="text-[11px] uppercase tracking-[0.2em] text-[#71717a]">{label}</p>
    <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
  </div>
);

const HistoryPanel = ({ user, records, userStats, onOpenRecord, onLogout, isLoading, error }) => (
  <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 md:p-7 backdrop-blur-sm shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-[#34d399]">Archive</p>
        <h3 className="text-2xl font-semibold text-white">{user?.username}</h3>
        <p className="text-sm leading-6 text-[#a1a1aa]">已登录。新的测试会自动保存，最近记录也可加入匿名匹配池。</p>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="rounded-full border border-white/10 px-4 py-2 text-sm text-[#d4d4d8] transition hover:border-white/30 hover:text-white cursor-pointer"
      >
        退出登录
      </button>
    </div>

    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      <StatPill label="我的测试" value={userStats?.tested_count ?? records.length} />
      <StatPill label="主动匹配" value={userStats?.initiated_matches ?? 0} />
      <StatPill label="被匹配" value={userStats?.received_matches ?? 0} />
    </div>

    <div className="mt-6 space-y-3">
      <div className="flex items-center justify-between text-sm text-[#a1a1aa]">
        <span>历史记录</span>
        <span>{isLoading ? '同步中...' : `${records.length} 条`}</span>
      </div>

      {error && <p className="text-sm text-[#fca5a5]">{error}</p>}

      {records.length === 0 && !isLoading && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm text-[#71717a]">
          还没有保存记录。完成一次测试后，这里会出现你的时间线。
        </div>
      )}

      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
        {records.map((record) => (
          <button
            key={record.record_id}
            type="button"
            onClick={() => onOpenRecord?.(record.record_id)}
            className="w-full rounded-2xl border border-white/8 bg-black/25 px-4 py-4 text-left transition hover:border-[#34d399]/40 hover:bg-white/[0.06] cursor-pointer"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm text-[#f4f4f5]">{record.headline || '未命名报告'}</p>
                <p className="text-xs text-[#71717a]">{record.brutal_summary || '暂无摘要'}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] ${record.is_match_enabled ? 'bg-[#34d399]/15 text-[#86efac]' : 'bg-white/8 text-[#a1a1aa]'}`}>
                {record.is_match_enabled ? '已入池' : '未入池'}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-[#71717a]">
              <span>{[record.main_label, record.shadow_label].filter(Boolean).join(' / ') || '类型待定'}</span>
              <span>{formatDateTime(record.created_at)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  </div>
);

export default HistoryPanel;
