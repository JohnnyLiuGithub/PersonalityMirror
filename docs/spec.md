# Personality Mirror V1 - Product Specification

## 1. Product Overview
**Name**: Personality Mirror (人格镜子)
**Positioning**: AI Personality Insight & Self-Reflection Tool
**Core Value**: Identify personality patterns through questions -> Generate stinging but truthful insights -> Create shareable cards -> Entry point for psychological growth.
**Tagline**: "A mirror that doesn't flatter you" (一面不讨好你的镜子)

## 2. User Experience Flow
1. **Landing**: Introduction & "Start" button.
2. **Generate Questions**: System generates 10 questions based on blueprint (AI polished).
3. **Answer**: User answers 10 questions (6 MCQ, 2 Rank, 2 Short Answer).
4. **Scoring**: System calculates scores across 6 dimensions.
5. **Type ID**: Identify one of 20 personality types based on scores.
6. **Report**: AI generates detailed report (Surface, Deep, Defense, etc.).
7. **Share**: Generate shareable card with traits & insights.

## 3. Personality Framework (6 Dimensions)
Range: [-100, 100]
1. **Attachment**: Intimacy (Positive) vs Avoidance (Negative)
2. **Control**: Control (Positive) vs Letting Go (Negative)
3. **Self-Value**: External Validation (Positive) vs Internal Standard (Negative)
4. **Conflict**: Confront (Positive) vs Avoid (Negative)
5. **Action**: Action (Positive) vs Overthinking (Negative)
6. **Desire**: Express (Positive) vs Repress (Negative)

## 4. Question Structure
Total 10 questions per session:
- **6 MCQs**: Options A (+2), B (+1), C (-1), D (-2). Score += delta * 25.
- **2 Rank**: Rank 4 items. 1st (+3), 2nd (+1), 3rd (-1), 4th (-3). Score += pref_score * 10.
- **2 Short Answer**: No direct score. AI extracts qualitative data (emotions, defenses, desires).

**Blueprint Object**:
```typescript
interface Question {
  id: string;
  type: "mcq" | "rank" | "short";
  dimension_primary: string;
  dimension_secondary: string | null;
  scenario: string;
  question_text: string;
  options?: string[]; // For MCQ
  rank_items?: string[]; // For Rank
  answer_hint?: string; // For Short
  scoring_key?: any;
}
```

## 5. Personality Types (20 Types)
Categorized into:
- **Control**: Hidden Controller, Order Guardian, Performance Driver
- **Observation**: Rational Defender, Emotion Observer, Loner Thinker
- **Relationship**: Intimacy Seeker, Boundary Guardian, Empathy Supporter
- **Action**: Action Explorer, Adventure Driver, Creative Thinker
- **Defense**: Emotion Avoider, Self-Protector, Invisible Bearer
- **Growth**: Self-Explorer, Self-Healer, Meaning Seeker
- **Complex**: Contradictory Idealist, Deep Introspector

**Algorithm**:
1. Calculate 6 dimension scores.
2. Discretize: |score| < 20 (MID), 20-60 (HIGH), >60 (EXTREME).
3. Match against rules (highest match score wins).

## 6. AI Integration
**Provider**: Doubao (Volcengine)
**Model**: `doubao-seed-2-0-lite-260215`
**Endpoint**: `https://ark.cn-beijing.volces.com/api/v3/responses`

**Calls**:
1. **Generate Questions**: Input Blueprint -> Output Question JSON.
2. **Generate Report**: Input (Scores, Type, Answers) -> Output Report JSON.

**Report Structure**:
- Headline
- Surface Persona
- Core Drives
- Defense Mechanisms
- Relationship Pattern
- Life Pattern
- Risks
- Growth Advice
- Brutal Summary
- Card Content (Label, Traits, Insight)

## 7. Technical Architecture
**Frontend**:
- React (Vite)
- Tailwind CSS (Dark psychological theme, neon accents)
- Zustand (State management)
- `axios` (API calls)

**Backend**:
- Node.js + Express
- `dotenv`, `cors`, `axios`
- Supabase Client (for `sessions` table)

**Database (Supabase)**:
- Table: `sessions`
- Columns: `id` (UUID), `questions` (JSON), `answers` (JSON), `scores` (JSON), `report` (JSON), `card` (JSON), `created_at` (Timestamp), `referrer` (String).

**API Endpoints**:
- `POST /api/generate-questions`
- `POST /api/submit-answers` (Calculates score & type)
- `POST /api/generate-report`

## 8. Visual Style
- **Theme**: Dark Mode (Deep background, neon lines).
- **Ref**: Apple, Notion, Psychological apps.
- **Card**: Minimalist, shareable.
