import test from 'node:test';
import assert from 'node:assert/strict';
import { BLUEPRINT } from './constants.js';
import { normalizeQuestions, safeJsonParse, validateReportSchema } from './aiGuards.js';

const cloneQuestion = (id) => structuredClone(BLUEPRINT.find((question) => question.id === id));

test('safeJsonParse extracts JSON from markdown wrapper', () => {
  const parsed = safeJsonParse('```json\n{"ok":true}\n```', 'object');
  assert.deepEqual(parsed, { ok: true });
});

test('normalizeQuestions falls back to positional matching when id is missing', () => {
  const generated = BLUEPRINT.map((question) => {
    const base = {
      type: question.type,
      dimension_primary: question.dimension_primary,
      scenario: `${question.scenario} `,
      question_text: `${question.question_text} `
    };

    if (question.type === 'mcq') {
      return {
        ...base,
        options: [...question.options],
        scoring_key: { ...question.scoring_key }
      };
    }

    if (question.type === 'rank') {
      return {
        ...base,
        rank_items: [...question.rank_items]
      };
    }

    return {
      ...base,
      answer_hint: `${question.answer_hint} `
    };
  });

  const normalized = normalizeQuestions(generated);
  assert.equal(normalized?.length, BLUEPRINT.length);
  assert.equal(normalized?.[0].id, BLUEPRINT[0].id);
  assert.deepEqual(normalized?.[8].rank_map, BLUEPRINT[8].rank_map);
});

test('normalizeQuestions rejects duplicate mcq options', () => {
  const generated = BLUEPRINT.map((question) => structuredClone(question));
  generated[0] = {
    ...cloneQuestion('q1'),
    options: ['same', 'same', 'other', 'other-2']
  };

  assert.equal(normalizeQuestions(generated), null);
});

test('validateReportSchema enforces array counts and trims brutal summary', () => {
  const validated = validateReportSchema({
    headline: 'headline',
    brutal_summary: '1234567890123456789012345678901234567890-extra',
    surface_persona: 'surface',
    core_drives: 'core',
    defense_mechanisms: ['a', 'b'],
    relationship_pattern: 'relationship',
    life_pattern: 'life',
    risks: ['r1', 'r2'],
    growth_advice: ['g1', 'g2'],
    shadow_analysis: 'shadow',
    card_label: 'main',
    card_shadow_label: 'shadow',
    card_traits: ['t1', 't2', 't3'],
    card_insight: 'insight'
  });

  assert.equal(validated?.brutal_summary.length, 40);
  assert.deepEqual(validated?.card_traits, ['t1', 't2', 't3']);
});

test('validateReportSchema rejects invalid trait counts', () => {
  const report = {
    headline: 'headline',
    brutal_summary: 'summary',
    surface_persona: 'surface',
    core_drives: 'core',
    defense_mechanisms: ['a', 'b'],
    relationship_pattern: 'relationship',
    life_pattern: 'life',
    risks: ['r1', 'r2'],
    growth_advice: ['g1', 'g2'],
    shadow_analysis: 'shadow',
    card_label: 'main',
    card_shadow_label: 'shadow',
    card_traits: ['t1', 't2'],
    card_insight: 'insight'
  };

  assert.equal(validateReportSchema(report), null);
});
