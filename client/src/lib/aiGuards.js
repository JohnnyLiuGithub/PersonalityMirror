import { BLUEPRINT } from './constants.js';

const REQUIRED_REPORT_FIELDS = [
  'headline',
  'brutal_summary',
  'surface_persona',
  'core_drives',
  'defense_mechanisms',
  'relationship_pattern',
  'life_pattern',
  'risks',
  'growth_advice',
  'shadow_analysis',
  'card_label',
  'card_shadow_label',
  'card_traits',
  'card_insight'
];

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const deepEqual = (left, right) => {
  if (left === right) return true;
  if (typeof left !== typeof right) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => deepEqual(item, right[index]));
  }
  if (isObject(left) && isObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every((key) => deepEqual(left[key], right[key]));
  }
  return false;
};

export const safeJsonParse = (raw, expectedType = 'object') => {
  if (isObject(raw) || Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return null;

  let text = raw.trim();
  text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

  const open = expectedType === 'array' ? '[' : '{';
  const close = expectedType === 'array' ? ']' : '}';
  const start = text.indexOf(open);
  const end = text.lastIndexOf(close);

  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const getQuestionCandidate = (generated, byId, source, index) => {
  const direct = byId.get(source.id);
  if (isObject(direct)) {
    return direct;
  }

  const fallback = generated[index];
  return isObject(fallback) ? fallback : null;
};

export const normalizeQuestions = (generated, blueprint = BLUEPRINT) => {
  if (!Array.isArray(generated)) return null;
  if (!Array.isArray(blueprint) || blueprint.length === 0) return null;

  const byId = new Map(
    generated
      .filter((item) => isObject(item) && item.id)
      .map((item) => [item.id, item])
  );

  const normalized = blueprint.map((source, index) => {
    const candidate = getQuestionCandidate(generated, byId, source, index);
    if (!isObject(candidate)) return null;
    if (candidate.type !== source.type || candidate.dimension_primary !== source.dimension_primary) return null;

    const base = {
      ...source,
      question_text: typeof candidate.question_text === 'string' ? candidate.question_text.trim() : source.question_text,
      scenario: typeof candidate.scenario === 'string' ? candidate.scenario.trim() : source.scenario
    };

    if (!base.question_text || !base.scenario) return null;

    if (source.type === 'mcq') {
      if (!Array.isArray(candidate.options) || candidate.options.length !== source.options.length) return null;
      if (!deepEqual(candidate.scoring_key, source.scoring_key)) return null;
      const options = candidate.options.map((option) => String(option).trim());
      if (new Set(options).size !== options.length) return null;
      return { ...base, options, scoring_key: source.scoring_key };
    }

    if (source.type === 'rank') {
      if (!Array.isArray(candidate.rank_items) || candidate.rank_items.length !== source.rank_items.length) return null;
      return {
        ...base,
        rank_items: source.rank_items,
        rank_map: source.rank_map,
        scoring_key: source.scoring_key
      };
    }

    if (source.type === 'short') {
      return {
        ...base,
        answer_hint: typeof candidate.answer_hint === 'string' ? candidate.answer_hint.trim() : source.answer_hint
      };
    }

    return base;
  });

  return normalized.every(Boolean) ? normalized : null;
};

export const validateReportSchema = (report) => {
  if (!isObject(report)) return null;

  for (const key of REQUIRED_REPORT_FIELDS) {
    if (!(key in report)) {
      return null;
    }
  }

  if (!Array.isArray(report.defense_mechanisms) || !Array.isArray(report.risks) || !Array.isArray(report.growth_advice) || !Array.isArray(report.card_traits)) {
    return null;
  }

  const defenseMechanisms = report.defense_mechanisms.map((x) => String(x).trim()).filter(Boolean);
  const risks = report.risks.map((x) => String(x).trim()).filter(Boolean);
  const growthAdvice = report.growth_advice.map((x) => String(x).trim()).filter(Boolean);
  const cardTraits = report.card_traits.map((x) => String(x).trim()).filter(Boolean);

  if (defenseMechanisms.length !== 2 || risks.length !== 2 || growthAdvice.length !== 2 || cardTraits.length !== 3) {
    return null;
  }

  return {
    headline: String(report.headline).trim(),
    brutal_summary: String(report.brutal_summary).trim().slice(0, 40),
    surface_persona: String(report.surface_persona).trim(),
    core_drives: String(report.core_drives).trim(),
    defense_mechanisms: defenseMechanisms,
    relationship_pattern: String(report.relationship_pattern).trim(),
    life_pattern: String(report.life_pattern).trim(),
    risks,
    growth_advice: growthAdvice,
    shadow_analysis: String(report.shadow_analysis).trim(),
    card_label: String(report.card_label).trim(),
    card_shadow_label: String(report.card_shadow_label).trim(),
    card_traits: cardTraits,
    card_insight: String(report.card_insight).trim()
  };
};

export const validateMatchSchema = (value) => {
  if (!isObject(value)) return null;

  const normalizeList = (items) => {
    if (!Array.isArray(items)) return null;
    const cleaned = items.map((item) => String(item).trim()).filter(Boolean);
    return cleaned.length >= 2 ? cleaned.slice(0, 2) : null;
  };

  const comfortableMoments = normalizeList(value.comfortable_moments);
  const uncomfortableMoments = normalizeList(value.uncomfortable_moments);
  const adviceForYou = normalizeList(value.advice_for_you);
  const adviceForThem = normalizeList(value.advice_for_them);

  if (!comfortableMoments || !uncomfortableMoments || !adviceForYou || !adviceForThem) {
    return null;
  }

  const comfortableReason = String(value.comfortable_reason || '').trim();
  const uncomfortableReason = String(value.uncomfortable_reason || '').trim();
  const whatToDo = String(value.what_to_do || '').trim();
  if (!comfortableReason || !uncomfortableReason || !whatToDo) {
    return null;
  }

  return {
    summary: String(value.summary || '').trim(),
    comfortable_moments: comfortableMoments,
    comfortable_reason: comfortableReason,
    uncomfortable_moments: uncomfortableMoments,
    uncomfortable_reason: uncomfortableReason,
    what_to_do: whatToDo,
    advice_for_you: adviceForYou,
    advice_for_them: adviceForThem,
    joint_advice: String(value.joint_advice || '').trim()
  };
};
