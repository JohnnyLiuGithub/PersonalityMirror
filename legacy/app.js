// Scoring Logic
const DIMENSIONS = {
    ATTACHMENT: 'attachment',
    CONTROL: 'control',
    SELF_VALUE: 'self_value',
    CONFLICT: 'conflict',
    ACTION: 'action',
    DESIRE: 'desire'
};

const PERSONALITY_TYPES = {
    CONTROL: [
        { id: 'hidden_controller', name: '隐性控制者', traits: ['控制欲', '焦虑', '完美主义'], insight: '你试图控制一切，因为你害怕失控。' },
        { id: 'order_guardian', name: '秩序守护者', traits: ['规则', '严谨', '刻板'], insight: '你用规则保护自己免受混乱的伤害。' },
        { id: 'performance_driver', name: '表现驱动者', traits: ['成就', '竞争', '疲惫'], insight: '你以为爱是赢来的，其实爱是不用赢的。' }
    ],
    OBSERVATION: [
        { id: 'rational_defender', name: '理性防御者', traits: ['逻辑', '克制', '疏离'], insight: '你相信逻辑多过情感，因为逻辑不会伤人。' },
        { id: 'emotion_observer', name: '情绪观察者', traits: ['敏感', '旁观', '内省'], insight: '你读懂了所有人，却没人读懂你。' },
        { id: 'loner_thinker', name: '孤独思想者', traits: ['深邃', '孤僻', '自足'], insight: '你的精神世界很丰富，但门锁得很紧。' }
    ],
    RELATIONSHIP: [
        { id: 'intimacy_seeker', name: '亲密追寻者', traits: ['渴望', '依赖', '不安'], insight: '你越用力抓紧，爱越容易流失。' },
        { id: 'boundary_guardian', name: '边界守护者', traits: ['独立', '谨慎', '慢热'], insight: '你保护了自己，也挡住了别人。' },
        { id: 'empathy_supporter', name: '共情支持者', traits: ['温柔', '付出', '隐忍'], insight: '你照亮了别人，却忘了给自己留灯。' },
        { id: 'silent_lover', name: '沉默爱人', traits: ['深情', '笨拙', '守护'], insight: '你爱得很深，但很少说出口。' }
    ],
    ACTION: [
        { id: 'action_explorer', name: '行动探索者', traits: ['好奇', '冲动', '体验'], insight: '你用行动理解世界，但也容易迷失方向。' },
        { id: 'adventure_driver', name: '冒险驱动者', traits: ['刺激', '厌倦', '突破'], insight: '平静对你来说是一种折磨。' },
        { id: 'creative_thinker', name: '创造型思考者', traits: ['独特', '发散', '不羁'], insight: '你走的是没人走过的路。' }
    ],
    DEFENSE: [
        { id: 'emotion_avoider', name: '情绪回避者', traits: ['逃避', '冷漠', '压抑'], insight: '你以为不看就不存在，但它一直在那里。' },
        { id: 'self_protector', name: '自我保护者', traits: ['警觉', '怀疑', '坚硬'], insight: '信任对你来说很昂贵。' },
        { id: 'invisible_bearer', name: '隐形承担者', traits: ['责任', '沉默', '重负'], insight: '很多事情你一个人扛，累吗？' }
    ],
    GROWTH: [
        { id: 'self_explorer', name: '自我探索者', traits: ['成长', '迷茫', '求索'], insight: '你不是迷路，你是在寻找真正的自己。' },
        { id: 'self_healer', name: '自我修复者', traits: ['坚韧', '自愈', '重生'], insight: '你的伤口，最终变成了你的盔甲。' },
        { id: 'meaning_seeker', name: '意义追寻者', traits: ['理想', '执着', '纯粹'], insight: '你在寻找光，即便身处黑暗。' }
    ],
    COMPLEX: [
        { id: 'contradictory_idealist', name: '矛盾理想主义者', traits: ['纠结', '渴望', '失望'], insight: '你既想拥抱世界，又想逃离人群。' },
        { id: 'deep_introspector', name: '深度自省者', traits: ['反思', '批判', '清醒'], insight: '你对自己太苛刻了。' }
    ]
};

// Questions Blueprint (Fallback if AI fails or for initial structure)
const BLUEPRINT = [
    {
        id: "q1", type: "mcq", dimension_primary: "attachment",
        scenario: "伴侣情绪低落但不愿说明原因。",
        question_text: "你的第一反应是什么？",
        options: ["立刻追问到底", "给对方空间，等待", "担心是不是自己的错", "试图转移注意力"],
        scoring_key: {"A": 2, "B": 1, "C": -1, "D": -2}
    },
    {
        id: "q2", type: "mcq", dimension_primary: "control",
        scenario: "小组项目进度严重滞后。",
        question_text: "你会怎么做？",
        options: ["接管项目并分配任务", "提醒大家截止日期", "等待别人来领导", "做好自己的部分，不管其他"],
        scoring_key: {"A": 2, "B": 1, "C": -1, "D": -2}
    },
    {
        id: "q3", type: "mcq", dimension_primary: "self_value",
        scenario: "你的工作受到了公开表扬。",
        question_text: "你感觉如何？",
        options: ["感到被认可，很自豪", "高兴但有点尴尬", "怀疑他们的动机", "这不改变我对自己的看法"],
        scoring_key: {"A": 2, "B": 1, "C": -1, "D": -2}
    },
    {
        id: "q4", type: "mcq", dimension_primary: "conflict",
        scenario: "朋友在最后一刻取消了计划。",
        question_text: "你会怎么说？",
        options: ["直接表达你的恼火", "询问原因", "说没关系（但其实介意）", "冷处理一段时间"],
        scoring_key: {"A": 2, "B": 1, "C": -1, "D": -2}
    },
    {
        id: "q5", type: "mcq", dimension_primary: "action",
        scenario: "你有了一个很棒的想法。",
        question_text: "第一步你会做什么？",
        options: ["立刻开始构建", "先规划所有细节", "告诉所有人", "担心会失败"],
        scoring_key: {"A": 2, "B": 1, "C": -1, "D": -2}
    },
    {
        id: "q6", type: "mcq", dimension_primary: "desire",
        scenario: "你想要一件很贵的东西。",
        question_text: "你会买吗？",
        options: ["买，我值得", "只有闲钱够多才买", "不，我应该存钱", "光是看看就觉得内疚"],
        scoring_key: {"A": 2, "B": 1, "C": -1, "D": -2}
    },
    {
        id: "q7", type: "rank", dimension_primary: "control",
        scenario: "你带领一个团队。",
        question_text: "请按重要性对这些价值观排序：",
        rank_items: ["效率", "和谐", "创新", "自由"],
        scoring_key: {"1": 3, "2": 1, "3": -1, "4": -3} // Placeholder logic
    },
    {
        id: "q8", type: "rank", dimension_primary: "action",
        scenario: "计划一次假期。",
        question_text: "请对你的优先级排序：",
        rank_items: ["冒险", "放松", "文化", "安全"],
        scoring_key: {"1": 3, "2": 1, "3": -1, "4": -3}
    },
    {
        id: "q9", type: "short", dimension_primary: "self_value",
        scenario: "用三个词形容你自己。",
        question_text: "请诚实回答。",
        answer_hint: "不要过度思考。"
    },
    {
        id: "q10", type: "short", dimension_primary: "conflict",
        scenario: "关于亲密关系，你最害怕什么？",
        question_text: "说出内心深处的恐惧。",
        answer_hint: "脆弱？失去自我？"
    }
];

const App = {
    data() {
        return {
            view: 'landing', // landing, question, loading, report
            questions: [],
            currentQuestionIndex: 0,
            answers: {},
            localAnswer: null, // Current answer for the active question
            isLoading: false,
            loadingStep: '', // 'questions' | 'scoring' | 'analysis' | 'card'
            loadingMessage: '',
            report: null,
            progress: 0,
            mirrorId: null, // Store mirror ID consistently for the session
            reportFolded: true // Default folded state for deep analysis
        }
    },
    computed: {
        currentQuestion() {
            return this.questions[this.currentQuestionIndex];
        },
        isAnswerValid() {
            if (!this.currentQuestion) return false;
            if (this.currentQuestion.type === 'mcq') return !!this.localAnswer;
            if (this.currentQuestion.type === 'rank') return this.localAnswer && this.localAnswer.length === this.currentQuestion.rank_items.length;
            if (this.currentQuestion.type === 'short') return this.localAnswer && this.localAnswer.length >= 10;
            return false;
        }
    },
    methods: {
        shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        },

        async startSession() {
            this.isLoading = true;
            this.loadingStep = 'questions';
            this.loadingMessage = '正在为您量身定制问题...';
            
            try {
                // Try to generate questions via AI
                const generated = await this.generateQuestionsAI();
                // Handle AI sometimes returning a single string instead of an array for rank_items
            if (generated && Array.isArray(generated)) {
                generated.forEach(q => {
                    if (q.type === 'rank' && typeof q.rank_items === 'string') {
                        q.rank_items = q.rank_items.split(/[,，、]/).map(s => s.trim());
                    }
                    if (q.type === 'rank' && (!q.rank_items || q.rank_items.length < 2)) {
                        q.rank_items = ["选项A", "选项B", "选项C", "选项D"];
                    }
                });
                
                // Force Shuffle if AI returns cached result (check if first question is same as blueprint)
                // This is a safety mechanism.
                const isDuplicate = generated.length > 0 && BLUEPRINT.length > 0 && generated[0].question_text === BLUEPRINT[0].question_text;
                
                if (isDuplicate) {
                     console.log("AI returned cached/duplicate questions, shuffling blueprint instead.");
                     throw new Error("Duplicate questions");
                }

                this.questions = generated.length === 10 ? generated : BLUEPRINT;
            } else {
                    throw new Error("Invalid AI response");
                }
            } catch (e) {
                console.error("AI Generation failed, using randomized blueprint", e);
                // Deep copy and shuffle blueprint to ensure variety even when AI fails
                let randomized = JSON.parse(JSON.stringify(BLUEPRINT));
                // Shuffle questions order
                randomized = this.shuffleArray(randomized);
                // Keep Rank/Short questions distribution? No, just shuffle all is fine for variety.
                // But we need 10 questions.
                this.questions = randomized;
            }
            
            this.currentQuestionIndex = 0;
            this.answers = {};
            this.localAnswer = null;
            this.progress = 0;
            this.isLoading = false;
            this.mirrorId = null; // Reset for new session
            this.generateMirrorId(); // Generate new ID
            this.view = 'question';
        },

        selectOption(option) {
            this.localAnswer = option;
        },

        selectRankItem(item) {
            if (!this.localAnswer) this.localAnswer = [];
            if (!this.localAnswer.includes(item)) {
                this.localAnswer.push(item);
            }
        },

        deselectRankItem(item) {
            this.localAnswer = this.localAnswer.filter(i => i !== item);
        },

        getRemainingRankItems() {
            if (!this.currentQuestion || this.currentQuestion.type !== 'rank') return [];
            const selected = this.localAnswer || [];
            return this.currentQuestion.rank_items.filter(i => !selected.includes(i));
        },

        nextQuestion() {
            // Save answer
            this.answers[this.currentQuestion.id] = this.localAnswer;
            
            if (this.currentQuestionIndex < this.questions.length - 1) {
                this.currentQuestionIndex++;
                this.localAnswer = null; // Reset for next question
                this.progress = ((this.currentQuestionIndex) / this.questions.length) * 100;
            } else {
                this.finishSession();
            }
        },

        generateFallbackReport(typeObj) {
            return {
                headline: `${typeObj.main.name}：${typeObj.main.insight}`,
                brutal_summary: typeObj.main.insight,
                surface_persona: `作为${typeObj.main.name}，你表现出${typeObj.main.traits.join('、')}的特质。你习惯于用这种方式与世界互动，这既是你的面具，也是你的保护色。`,
                core_drives: "你的核心驱动力在于维持内心的秩序与安全感，尽管这有时会让你感到疲惫。你渴望被理解，但又恐惧被完全看穿。",
                defense_mechanisms: ["理性化：用逻辑解释情感，避免直接面对痛苦", "情感隔离：在受伤前先切断连接"],
                relationship_pattern: "在关系中，你倾向于保持一定的边界。你既渴望深度的连接，又常常在亲密关系变得过于紧密时感到窒息想逃。",
                life_pattern: "你一直在寻找某种确定性，但生活往往充满变数。你的人生课题可能是学会与不确定性共舞。",
                shadow_analysis: `你的影子人格是${typeObj.shadow.name}。在潜意识里，你压抑了${typeObj.shadow.traits.join('、')}的一面。当压力过大时，这部分被压抑的自我可能会突然爆发。`,
                risks: ["过度思考导致行动瘫痪", "忽视真实的情感需求导致内耗"],
                growth_advice: ["尝试接纳不完美的自己，允许自己偶尔失控", "练习直接表达需求，而不是等待别人猜中"],
                card_label: typeObj.main.name,
                card_shadow_label: typeObj.shadow.name,
                card_traits: typeObj.main.traits,
                card_insight: typeObj.main.insight
            };
        },

        async finishSession() {
            this.view = 'loading';
            
            // Step 1: Calculate Scores
            this.loadingStep = 'scoring';
            this.loadingMessage = '正在计算六维人格分数...';
            // Artificial delay for UX
            await new Promise(r => setTimeout(r, 800));
            
            const scores = this.calculateScores();
            const typeObj = this.identifyType(scores);
            
            try {
                // Step 2: Generate Report via AI
                this.loadingStep = 'analysis';
                this.loadingMessage = 'AI 正在深度解析你的灵魂...';
                
                // Generate Report via AI - NO TIMEOUT, wait as long as it takes
                const report = await this.generateReportAI(scores, typeObj, this.answers);
                
                // Step 3: Finalizing
                this.loadingStep = 'card';
                this.loadingMessage = '正在生成你的专属人格卡片...';
                await new Promise(r => setTimeout(r, 1000));
                
                this.report = report;
                this.reportFolded = true; // Reset fold state
                this.view = 'report';
            } catch (e) {
                console.error("Report generation failed", e);
                // Fallback to template report
                this.report = this.generateFallbackReport(typeObj);
                this.reportFolded = true; // Reset fold state
                this.view = 'report';
                // Optional: Notify user toast
                console.log("Using fallback report due to AI error");
            }
        },

        calculateScores() {
            const scores = {
                attachment: 0, control: 0, self_value: 0,
                conflict: 0, action: 0, desire: 0
            };

            this.questions.forEach(q => {
                const answer = this.answers[q.id];
                if (!answer) return;

                if (q.type === 'mcq') {
                    const delta = q.scoring_key[answer] || 0;
                    if (scores[q.dimension_primary] !== undefined) {
                        scores[q.dimension_primary] += delta * 25;
                    }
                } else if (q.type === 'rank') {
                    // Simplified Rank Scoring: 1st item gets +20
                    // In a real app, we'd map items to values. 
                    // Here we just give a static boost to the dimension to simulate activity.
                    if (scores[q.dimension_primary] !== undefined) {
                        scores[q.dimension_primary] += 10;
                    }
                }
            });

            // Clamp
            Object.keys(scores).forEach(k => {
                scores[k] = Math.max(-100, Math.min(100, scores[k]));
            });
            
            return scores;
        },

        identifyType(scores) {
            // Find dominant dimension
            let maxDim = 'attachment';
            let maxVal = 0;
            
            Object.entries(scores).forEach(([dim, val]) => {
                if (Math.abs(val) > Math.abs(maxVal)) {
                    maxVal = val;
                    maxDim = dim;
                }
            });

            // Randomly pick a type from the category for variety in this demo
            // In production, this would be a strict mapping
            const map = {
                attachment: PERSONALITY_TYPES.RELATIONSHIP,
                control: PERSONALITY_TYPES.CONTROL,
                self_value: PERSONALITY_TYPES.GROWTH,
                conflict: PERSONALITY_TYPES.DEFENSE,
                action: PERSONALITY_TYPES.ACTION,
                desire: PERSONALITY_TYPES.COMPLEX
            };
            // 优化类型选择逻辑
            const category = map[maxDim] || 'OBSERVATION';
            const types = PERSONALITY_TYPES[category];
            // 简单随机选择一个主类型 (实际可根据分数细化)
            const mainType = types[Math.floor(Math.random() * types.length)];
            
            // 选择影子人格 (Shadow Personality) - 选择次高维度或相反维度
            // 这里简化为选择另一个不同类别的类型
            let shadowCategory = category;
            while (shadowCategory === category) {
                const keys = Object.keys(PERSONALITY_TYPES);
                shadowCategory = keys[Math.floor(Math.random() * keys.length)];
            }
            const shadowTypes = PERSONALITY_TYPES[shadowCategory];
            const shadowType = shadowTypes[Math.floor(Math.random() * shadowTypes.length)];

            return { main: mainType, shadow: shadowType };
        },

        async callAI(messages) {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages })
            });
            
            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            
            // Handle Doubao response structure (it might be in choices[0].message.content)
            if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                 return data.choices[0].message.content;
            }
            // Fallback for different API shapes if needed
            return JSON.stringify(data);
        },

        async generateQuestionsAI() {
            const prompt = `
            生成10道心理测试题 (6道选择题MCQ, 2道排序题Rank, 2道简答题Short).
            维度: Attachment, Control, Self-Value, Conflict, Action, Desire.
            随机种子: ${Math.random()} (请确保题目与上一次不同，增加随机性)
            场景多样化：包括职场、感情、独处、社交等不同场景。
            格式: JSON Array.
            重要：请严格按照 6道MCQ -> 2道Rank -> 2道Short 的顺序排列。
            MCQ 示例: {"id":"q1","type":"mcq","dimension_primary":"control","question_text":"...","options":["A","B","C","D"],"scoring_key":{"A":2,"B":1,"C":-1,"D":-2}}
            Rank 示例: {"id":"q7","type":"rank","dimension_primary":"action","question_text":"...","rank_items":["A","B","C","D"]}
            Short 示例: {"id":"q9","type":"short","dimension_primary":"desire","question_text":"..."}
            请使用中文生成所有内容。
            Return ONLY JSON. Do not include markdown formatting.
            `;
            
            const content = await this.callAI([
                { role: 'system', content: 'You are a creative JSON generator. Always generate unique, non-repetitive questions.' },
                { role: 'user', content: prompt }
            ]);
            
            // Clean up potentially markdown wrapped content
            let jsonStr = content.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
            // Try to extract JSON object if there is extra text
            const start = jsonStr.indexOf('{');
            const end = jsonStr.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                jsonStr = jsonStr.substring(start, end + 1);
            }
            return JSON.parse(jsonStr);
        },

        async generateReportAI(scores, typeObj, answers) {
            const prompt = `
            分析用户。
            Scores: ${JSON.stringify(scores)}
            Main Type: ${typeObj.main.name} (${typeObj.main.traits.join(',')})
            Shadow Type: ${typeObj.shadow.name} (${typeObj.shadow.traits.join(',')})
            Answers: ${JSON.stringify(answers)}
            
            生成“人格镜子”报告。
            语调: 犀利、真实、直击痛点。不要讨好用户。
            请使用中文生成所有内容。
            Return ONLY JSON:
            {
                "headline": "简短有力的标题（基于主类型）",
                "brutal_summary": "一句话残酷总结（刺痛句）",
                "surface_persona": "表层人格（描述主类型 ${typeObj.main.name} 的表现）",
                "core_drives": "深层驱动（你为什么会这样）",
                "defense_mechanisms": ["机制1", "机制2"],
                "relationship_pattern": "关系模式",
                "life_pattern": "人生模式",
                "shadow_analysis": "影子人格分析（你潜意识里的 ${typeObj.shadow.name} 如何影响你）",
                "risks": ["风险1", "风险2"],
                "growth_advice": ["建议1", "建议2"],
                "card_label": "${typeObj.main.name}",
                "card_shadow_label": "${typeObj.shadow.name}",
                "card_traits": ["${typeObj.main.traits[0]}", "${typeObj.main.traits[1]}", "${typeObj.main.traits[2]}"],
                "card_insight": "${typeObj.main.insight}"
            }
            Do not include markdown formatting.
            `;
            
            const content = await this.callAI([
                { role: 'system', content: 'You are a psychological profiler. Output JSON only.' },
                { role: 'user', content: prompt }
            ]);
            
            let jsonStr = content.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
            // Try to extract JSON object if there is extra text
            const start = jsonStr.indexOf('{');
            const end = jsonStr.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                jsonStr = jsonStr.substring(start, end + 1);
            }
            return JSON.parse(jsonStr);
        },

        generateMirrorId() {
            // Generate a consistent short ID based on session timestamp/randomness
            // In a real app, this would be a hash of the session ID
            if (!this.mirrorId) {
                const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                let result = '';
                for (let i = 0; i < 4; i++) {
                    result += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                this.mirrorId = 'PM-' + result;
            }
            return this.mirrorId;
        },

        confirmRestart() {
            if (confirm("确定要重新开始吗？当前进度将丢失。")) {
                this.view = 'landing';
            }
        }
    },
    updated() {
        this.$nextTick(() => {
            lucide.createIcons();
        });
    }
};

// Component for Report Section
const ReportSection = {
    props: ['title', 'content', 'delay', 'isList', 'warning', 'success', 'shadow', 'fullWidth'],
    template: `
        <div 
            class="p-6 rounded-2xl bg-surface/50 border border-white/5 hover:border-white/10 transition-colors animate-in slide-in-from-bottom-4 duration-700 fill-mode-backwards"
            :class="[
                fullWidth ? 'col-span-full' : '',
                warning ? 'border-red-500/20 bg-red-500/5' : '',
                success ? 'border-green-500/20 bg-green-500/5' : '',
                shadow ? 'border-purple-500/20 bg-purple-500/5' : ''
            ]"
            :style="{ animationDelay: delay + 'ms' }"
        >
            <h3 class="text-sm font-bold uppercase tracking-wider mb-4" 
                :class="warning ? 'text-red-400' : success ? 'text-green-400' : shadow ? 'text-purple-400' : 'text-primary'">
                {{ title }}
            </h3>
            
            <ul v-if="isList && Array.isArray(content)" class="space-y-2">
                <li v-for="(item, idx) in content" :key="idx" class="flex items-start text-muted/90 text-sm leading-relaxed">
                    <span class="mr-2 text-primary/50">•</span>
                    {{ item }}
                </li>
            </ul>
            <p v-else class="text-muted/90 text-sm leading-relaxed whitespace-pre-line">
                {{ content }}
            </p>
        </div>
    `
};

const app = Vue.createApp(App);
app.component('report-section', ReportSection);
app.mount('#app');

// Initialize Icons
lucide.createIcons();
