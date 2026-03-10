export const PERSONALITY_TYPES = {
  CONTROL: [
    {
      id: 'hidden_controller',
      name: '隐性控制者',
      traits: ['控制欲', '焦虑', '完美主义'],
      insight: '你想把一切安排妥当，本质上是在对抗失控感。'
    },
    {
      id: 'order_guardian',
      name: '秩序守护者',
      traits: ['规则感', '谨慎', '边界清晰'],
      insight: '你相信规则能带来安全，但过度依赖规则会削弱关系弹性。'
    },
    {
      id: 'performance_driver',
      name: '表现驱动者',
      traits: ['成就导向', '竞争', '高标准'],
      insight: '你用结果证明价值，容易把被爱误解成必须赢。'
    }
  ],
  OBSERVATION: [
    {
      id: 'rational_defender',
      name: '理性防御者',
      traits: ['逻辑', '克制', '审视'],
      insight: '你习惯先分析再行动，安全感来自看清结构。'
    },
    {
      id: 'emotion_observer',
      name: '情绪观察者',
      traits: ['敏感', '细腻', '旁观倾向'],
      insight: '你能捕捉情绪细节，但也容易停留在观察层。'
    },
    {
      id: 'loner_thinker',
      name: '独行思考者',
      traits: ['内省', '独立', '深度思维'],
      insight: '你在独处中恢复力量，但长期退后会削弱真实连接。'
    }
  ],
  RELATIONSHIP: [
    {
      id: 'intimacy_seeker',
      name: '亲密追寻者',
      traits: ['渴望靠近', '不安', '高投入'],
      insight: '你越怕失去，越容易在关系里用力过猛。'
    },
    {
      id: 'boundary_guardian',
      name: '边界守护者',
      traits: ['独立', '谨慎', '慢热'],
      insight: '你先保护自己再靠近别人，这让你稳定，也让你更难被进入。'
    },
    {
      id: 'empathy_supporter',
      name: '共情支持者',
      traits: ['温柔', '付出', '体贴'],
      insight: '你习惯先照顾别人，久了会忽略自己的真实需要。'
    },
    {
      id: 'silent_lover',
      name: '沉默爱人',
      traits: ['深情', '克制表达', '守护倾向'],
      insight: '你爱得很深，但表达太少会让对方误判你的温度。'
    }
  ],
  ACTION: [
    {
      id: 'action_explorer',
      name: '行动探索者',
      traits: ['好奇', '尝试导向', '执行快'],
      insight: '你靠行动理解世界，但有时会在速度里忽略方向。'
    },
    {
      id: 'adventure_driver',
      name: '冒险驱动者',
      traits: ['刺激偏好', '厌倦停滞', '突破欲'],
      insight: '你需要变化感保持活力，也要警惕把稳定误读成无聊。'
    },
    {
      id: 'creative_thinker',
      name: '创造型思考者',
      traits: ['发散', '创意', '不按常规'],
      insight: '你擅长看见新可能，难点在于把灵感持续落地。'
    }
  ],
  DEFENSE: [
    {
      id: 'emotion_avoider',
      name: '情绪回避者',
      traits: ['回避冲突', '压抑', '抽离'],
      insight: '你通过不碰痛点来维持平衡，但问题不会因此消失。'
    },
    {
      id: 'self_protector',
      name: '自我保护者',
      traits: ['警觉', '防御', '不轻信'],
      insight: '你很会保护边界，但高警惕也会让信任建立更慢。'
    },
    {
      id: 'invisible_bearer',
      name: '隐形承担者',
      traits: ['责任感', '沉默承压', '不求助'],
      insight: '你习惯自己扛住一切，久了会把疲惫变成常态。'
    }
  ],
  GROWTH: [
    {
      id: 'self_explorer',
      name: '自我探索者',
      traits: ['成长动机', '反思', '求索'],
      insight: '你在不断更新自己，但也要允许阶段性的不确定。'
    },
    {
      id: 'self_healer',
      name: '自我修复者',
      traits: ['韧性', '自愈', '重建能力'],
      insight: '你能从挫折中恢复，但恢复不等于不再受伤。'
    },
    {
      id: 'meaning_seeker',
      name: '意义追寻者',
      traits: ['理想', '价值感', '长期主义'],
      insight: '你需要意义感驱动行动，但别让完美意义阻碍真实开始。'
    }
  ],
  COMPLEX: [
    {
      id: 'contradictory_idealist',
      name: '矛盾理想主义者',
      traits: ['高标准', '拉扯感', '敏锐'],
      insight: '你既渴望靠近又害怕受伤，内心经常在两端摆动。'
    },
    {
      id: 'deep_introspector',
      name: '深度自省者',
      traits: ['反思', '清醒', '自我批判'],
      insight: '你看得很深，但过度自省会让行动被延迟。'
    }
  ]
};

export const BLUEPRINT = [
  {
    id: 'q1',
    type: 'mcq',
    dimension_primary: 'attachment',
    scenario: '伴侣情绪低落，却不愿告诉你原因。',
    question_text: '你更可能怎么做？',
    options: ['继续追问，希望尽快弄清楚', '给对方一些空间再观察', '担心是不是自己做错了什么', '尽量把注意力转移开'],
    scoring_key: { A: 2, B: 1, C: -1, D: -2 }
  },
  {
    id: 'q2',
    type: 'mcq',
    dimension_primary: 'control',
    scenario: '团队项目进度明显落后。',
    question_text: '你的第一反应更接近：',
    options: ['直接接管并重新安排', '提醒大家并跟进进度', '先看看别人会不会处理', '只做好自己的部分'],
    scoring_key: { A: 2, B: 1, C: -1, D: -2 }
  },
  {
    id: 'q3',
    type: 'mcq',
    dimension_primary: 'self_value',
    scenario: '你的工作被公开表扬。',
    question_text: '你的真实感受更接近：',
    options: ['感到被认可和自豪', '开心但有点不自在', '会怀疑对方是否客套', '这不会改变我对自己的评价'],
    scoring_key: { A: 2, B: 1, C: -1, D: -2 }
  },
  {
    id: 'q4',
    type: 'mcq',
    dimension_primary: 'conflict',
    scenario: '朋友临时取消与你的约定。',
    question_text: '你更可能：',
    options: ['直接表达不满', '问清楚发生了什么', '表面说没事但心里记着', '暂时疏远一阵'],
    scoring_key: { A: 2, B: 1, C: -1, D: -2 }
  },
  {
    id: 'q5',
    type: 'mcq',
    dimension_primary: 'action',
    scenario: '你突然想到一个想尝试的新项目。',
    question_text: '你通常会：',
    options: ['立刻开始做一个简单版本', '先写计划再行动', '先和别人聊聊想法', '想很多但迟迟不动'],
    scoring_key: { A: 2, B: 1, C: -1, D: -2 }
  },
  {
    id: 'q6',
    type: 'mcq',
    dimension_primary: 'desire',
    scenario: '你很想买一件价格偏高的东西。',
    question_text: '你更可能：',
    options: ['直接买下', '等预算合适再买', '觉得不该花这笔钱', '看很多次但最后放弃'],
    scoring_key: { A: 2, B: 1, C: -1, D: -2 }
  },
  {
    id: 'q7',
    type: 'mcq',
    dimension_primary: 'reflection',
    scenario: '你刚经历一次明显的失败。',
    question_text: '你更可能先做什么？',
    options: ['复盘到底哪里出了问题', '和信任的人聊聊', '先放下不再多想', '尽快投入下一件事'],
    scoring_key: { A: 2, B: 1, C: -1, D: -2 }
  },
  {
    id: 'q8',
    type: 'mcq',
    dimension_primary: 'attachment',
    scenario: '关系中出现明显距离感。',
    question_text: '你更容易：',
    options: ['主动拉近关系', '试探对方态度', '开始怀疑自己', '逐渐退回自己的空间'],
    scoring_key: { A: 2, B: 1, C: -1, D: -2 }
  },
  {
    id: 'q9',
    type: 'rank',
    dimension_primary: 'control',
    scenario: '你在带一个小团队推进任务。',
    question_text: '以下哪件事更重要？（从高到低）',
    rank_items: ['效率', '秩序', '稳定', '自由'],
    rank_map: {
      效率: { control: 1 },
      秩序: { control: 1 },
      稳定: { control: -1 },
      自由: { control: -1 }
    },
    scoring_key: { '1': 3, '2': 1, '3': -1, '4': -3 }
  },
  {
    id: 'q10',
    type: 'rank',
    dimension_primary: 'action',
    scenario: '你在规划一次假期。',
    question_text: '以下哪件事更吸引你？（从高到低）',
    rank_items: ['冒险', '体验', '放松', '安全'],
    rank_map: {
      冒险: { action: 1 },
      体验: { action: 1 },
      放松: { action: -1 },
      安全: { attachment: 1 }
    },
    scoring_key: { '1': 3, '2': 1, '3': -1, '4': -3 }
  },
  {
    id: 'q11',
    type: 'short',
    dimension_primary: 'self_value',
    scenario: '用三个词描述你自己。',
    question_text: '请尽量真实，而不是理想中的自己。',
    answer_hint: '想到什么先写什么。'
  },
  {
    id: 'q12',
    type: 'short',
    dimension_primary: 'conflict',
    scenario: '在亲密关系里，你最害怕发生什么？',
    question_text: '写下你通常不会直接说出口的担心。',
    answer_hint: '例如被忽视、被误解、失去自我等。'
  }
];
