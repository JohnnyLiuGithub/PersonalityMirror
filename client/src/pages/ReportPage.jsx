import { RefreshCw, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import ReportSection from '../components/ReportSection';
import PersonalityCard from '../components/PersonalityCard';

const ReportPage = ({ report, mirrorId, reportFolded, setReportFolded, onRestart }) => {
    return (
        <motion.div
            key="report"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-4xl mx-auto space-y-16 pb-20"
        >
            {/* Header Section */}
            <div className="text-center space-y-6 animate-in slide-in-from-bottom-8 duration-700">
                <span className="text-xs font-mono text-[#a855f7] uppercase tracking-[0.3em]">你的人格镜像</span>
                <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 leading-tight">
                    {report.headline}
                </h1>
                <p className="text-xl md:text-2xl text-[#71717a] font-light max-w-3xl mx-auto italic border-l-4 border-[#a855f7]/50 pl-6 py-2 bg-[#18181b]/30 rounded-r-xl">
                    "{report.brutal_summary}"
                </p>
            </div>

            {/* Core Analysis Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <ReportSection title="表层人格" content={report.surface_persona} delay={100} />
                {report.shadow_analysis && (
                    <ReportSection title="影子人格" content={report.shadow_analysis} delay={150} shadow />
                )}
                <ReportSection title="深层驱动" content={report.core_drives} delay={200} />
                <ReportSection title="防御机制" content={report.defense_mechanisms} isList delay={300} />
                <ReportSection title="关系模式" content={report.relationship_pattern} delay={400} />
            </div>

            {/* Deep Dive */}
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div onClick={() => setReportFolded(!reportFolded)} className="md:col-span-2 text-center py-2 cursor-pointer text-[#71717a] hover:text-white transition-colors flex items-center justify-center space-x-2">
                        <span>{reportFolded ? '展开更多深度分析' : '收起深度分析'}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${!reportFolded ? 'rotate-180' : ''}`} />
                    </div>

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

            {/* Personality Card Preview */}
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
        </motion.div>
    );
};

export default ReportPage;
