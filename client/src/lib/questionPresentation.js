const LETTERS = ['A', 'B', 'C', 'D'];

const toSeed = (text) => {
  let hash = 2166136261;
  const value = String(text || 'pm-default-seed');
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const createSeededRng = (seedText) => {
  let seed = toSeed(seedText);
  return () => {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleInPlace = (arr, rng) => {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const shuffleNonTrivial = (items, rng) => {
  const original = [...items];
  for (let i = 0; i < 6; i += 1) {
    const trial = shuffleInPlace([...items], rng);
    const isSame = trial.every((value, idx) => value === original[idx]);
    if (!isSame) {
      return trial;
    }
  }
  return shuffleInPlace([...items], rng);
};

const remapMcqQuestion = (question, rng) => {
  if (!Array.isArray(question.options) || question.options.length < 2 || !question.scoring_key) {
    return question;
  }

  const paired = question.options.map((text, index) => {
    const letter = LETTERS[index];
    return {
      text,
      score: question.scoring_key?.[letter] ?? 0
    };
  });

  const shuffledPairs = shuffleNonTrivial(paired, rng);
  const nextScoringKey = {};

  shuffledPairs.forEach((item, index) => {
    nextScoringKey[LETTERS[index]] = item.score;
  });

  return {
    ...question,
    options: shuffledPairs.map((item) => item.text),
    scoring_key: nextScoringKey
  };
};

const remapRankQuestion = (question, rng) => {
  if (!Array.isArray(question.rank_items) || question.rank_items.length < 2) {
    return question;
  }

  return {
    ...question,
    rank_items: shuffleNonTrivial(question.rank_items, rng)
  };
};

export const randomizeQuestionPresentation = (questions, rng = Math.random) => {
  if (!Array.isArray(questions)) {
    return questions;
  }

  return questions.map((question) => {
    if (!question || typeof question !== 'object') {
      return question;
    }

    if (question.type === 'mcq') {
      return remapMcqQuestion(question, rng);
    }

    if (question.type === 'rank') {
      return remapRankQuestion(question, rng);
    }

    return question;
  });
};
