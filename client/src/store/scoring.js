import { PERSONALITY_TYPES } from '../lib/constants.js';

export const DIMENSIONS = ['attachment', 'control', 'self_value', 'conflict', 'action', 'desire', 'reflection'];

const MCQ_SCALE = 15;
const RANK_SCALE = 6;
const SHORT_REFLECTION_SCALE = 5;
const REFLECTION_KEYWORD_REGEX = /\u53cd\u601d|\u601d\u8003|\u7406\u89e3|\u4e3a\u4ec0\u4e48/;
const DEFAULT_RANK_WEIGHTS = [3, 1, -1, -3];

const clampScore = (value) => Math.max(-100, Math.min(100, value));

const createEmptyScores = () => ({
  attachment: 0,
  control: 0,
  self_value: 0,
  conflict: 0,
  action: 0,
  desire: 0,
  reflection: 0
});

const getMcqDelta = (question, answer) => {
  if (!question.scoring_key || typeof question.scoring_key !== 'object') {
    return 0;
  }

  const value = question.scoring_key[answer];
  return Number.isFinite(value) ? value : 0;
};

const getRankWeight = (question, index) => {
  if (question.scoring_key && typeof question.scoring_key === 'object') {
    const mapped = question.scoring_key[String(index + 1)];
    if (Number.isFinite(mapped)) {
      return mapped;
    }
  }

  return DEFAULT_RANK_WEIGHTS[index] ?? 0;
};

export const calculateScores = (questions, answers) => {
  const scores = createEmptyScores();
  const evidence = [];
  const short_answers = [];

  questions.forEach((question) => {
    const answer = answers[question.id];
    if (answer === undefined || answer === null || answer === '') {
      return;
    }

    if (question.type === 'mcq') {
      const delta = getMcqDelta(question, answer);
      const contribution = delta * MCQ_SCALE;
      const dimension = question.dimension_primary;

      if (dimension in scores) {
        scores[dimension] += contribution;
      }

      evidence.push({
        question_id: question.id,
        question_type: question.type,
        dimension,
        answer,
        delta,
        contribution
      });
      return;
    }

    if (question.type === 'rank' && Array.isArray(answer)) {
      answer.forEach((item, index) => {
        const itemMap = question.rank_map?.[item];
        if (!itemMap || typeof itemMap !== 'object') {
          return;
        }

        const weight = getRankWeight(question, index);

        Object.entries(itemMap).forEach(([dimension, direction]) => {
          const numericDirection = Number(direction);
          if (!(dimension in scores) || !Number.isFinite(numericDirection)) {
            return;
          }

          const contribution = numericDirection * weight * RANK_SCALE;
          scores[dimension] += contribution;

          evidence.push({
            question_id: question.id,
            question_type: question.type,
            item,
            rank: index + 1,
            dimension,
            direction: numericDirection,
            weight,
            contribution
          });
        });
      });
      return;
    }

    if (question.type === 'short') {
      const text = String(answer).trim();

      if (question.id === 'q11' && REFLECTION_KEYWORD_REGEX.test(text)) {
        scores.reflection += SHORT_REFLECTION_SCALE;
      }

      short_answers.push({
        question_id: question.id,
        text
      });
      evidence.push({
        question_id: question.id,
        question_type: question.type,
        dimension: question.dimension_primary,
        summary: text.slice(0, 120)
      });
    }
  });

  DIMENSIONS.forEach((dimension) => {
    scores[dimension] = clampScore(scores[dimension]);
  });

  return {
    scores,
    evidence,
    short_answers
  };
};

const DIM_TO_CATEGORY = {
  attachment: 'RELATIONSHIP',
  control: 'CONTROL',
  self_value: 'GROWTH',
  conflict: 'DEFENSE',
  action: 'ACTION',
  desire: 'COMPLEX',
  reflection: 'OBSERVATION'
};

const getTier = (absScore) => {
  if (absScore >= 70) {
    return 'extreme';
  }
  if (absScore >= 35) {
    return 'high';
  }
  return 'mid';
};

const pickByTierAndSign = (types, score) => {
  if (!Array.isArray(types) || types.length === 0) {
    return null;
  }

  if (types.length === 1) {
    return types[0];
  }

  const isPositive = score >= 0;
  const tier = getTier(Math.abs(score));
  const positiveOrder = [0, 1, 2, 3];
  const negativeOrder = [types.length - 1, types.length - 2, 1, 0]
    .filter((index, idx, arr) => index >= 0 && index < types.length && arr.indexOf(index) === idx);

  const order = isPositive ? positiveOrder : negativeOrder;
  const tierIndex = tier === 'extreme' ? 0 : tier === 'high' ? 1 : 2;
  const chosenIndex = order[tierIndex] ?? order[order.length - 1] ?? 0;
  return types[chosenIndex] ?? types[0];
};

export const identifyType = (scores) => {
  const ordered = DIMENSIONS
    .map((dimension) => [dimension, Number(scores[dimension]) || 0])
    .sort((a, b) => {
      const diff = Math.abs(b[1]) - Math.abs(a[1]);
      if (diff !== 0) {
        return diff;
      }
      return DIMENSIONS.indexOf(a[0]) - DIMENSIONS.indexOf(b[0]);
    });

  const [mainDim, mainScore] = ordered[0];
  const [shadowDim, shadowScore] = ordered[1] ?? ordered[0];

  const mainCategory = DIM_TO_CATEGORY[mainDim] || 'COMPLEX';
  const shadowCategory = DIM_TO_CATEGORY[shadowDim] || 'COMPLEX';

  const mainType = pickByTierAndSign(PERSONALITY_TYPES[mainCategory], mainScore);
  let shadowType = pickByTierAndSign(PERSONALITY_TYPES[shadowCategory], shadowScore);

  if (mainType && shadowType && shadowType.id === mainType.id) {
    const pool = PERSONALITY_TYPES[shadowCategory] || [];
    shadowType = pool.find((type) => type.id !== mainType.id) || shadowType;
  }

  return {
    main: mainType,
    shadow: shadowType,
    debug: {
      mainDim,
      shadowDim,
      ordered
    }
  };
};



