# Checklist

## Functional Requirements
- [x] **Landing Page**: Loads correctly, "Start" button initiates flow.
- [x] **Question Generation**: 
    - [x] Generates 10 questions (6 MCQ, 2 Rank, 2 Short).
    - [x] Questions align with dimensions.
- [x] **Answering**:
    - [x] UI supports selecting MCQ options.
    - [x] UI supports drag/drop or ordering for Rank questions.
    - [x] UI supports text input for Short answers.
- [x] **Scoring**:
    - [x] MCQ scores calculated correctly (+2, +1, -1, -2).
    - [x] Rank scores calculated correctly (+3, +1, -1, -3).
    - [x] Final dimension scores fall within [-100, 100].
- [x] **Personality Identification**:
    - [x] System correctly identifies one of the 20 types based on scores (Simplified logic for V1).
- [x] **AI Report**:
    - [x] Report contains all required sections (Headline, Surface, Deep, etc.).
    - [x] Content tone is "stinging but true" (via Prompt).
    - [x] Card content is generated.
- [x] **Data Persistence**:
    - [x] Session data is saved to Supabase (or mock if no creds).

## Technical Requirements
- [x] **Frontend**: React + Tailwind + Zustand.
- [x] **Backend**: Node.js + Express.
- [x] **AI Integration**: Successfully calls Doubao API via `https://ark.cn-beijing.volces.com/api/v3/responses`.
- [x] **Performance**: AI response time handled with loading states.
- [x] **Responsiveness**: Works on Mobile and Desktop.

## Visual Requirements
- [x] **Theme**: Dark mode, psychological style.
- [x] **Card**: Visually distinct, looks like a shareable asset.
