# Tasks

## Phase 1: Project Initialization
- [ ] Initialize Git repository (if not already).
- [ ] Create `client` (React+Vite) and `server` (Node+Express) directories.
- [ ] Initialize `package.json` for both.
- [ ] Install dependencies:
    - Client: `react`, `react-dom`, `tailwindcss`, `postcss`, `autoprefixer`, `zustand`, `axios`, `framer-motion`, `lucide-react`, `react-router-dom`.
    - Server: `express`, `cors`, `dotenv`, `axios`, `@supabase/supabase-js`, `nodemon`.
- [ ] Configure Tailwind CSS in Client.
- [ ] Set up `concurrently` in root to run both client and server (optional but good for dev).

## Phase 2: Backend Implementation
- [ ] Create `.env` file for API keys (Doubao, Supabase).
- [ ] **Core Logic**:
    - [ ] Implement `PersonalityDimension` types and constants.
    - [ ] Implement `QuestionBlueprint` structure.
    - [ ] Implement `ScoringEngine` (MCQ & Rank calculation).
    - [ ] Implement `PersonalityTypeClassifier` (20 types logic).
- [ ] **AI Service**:
    - [ ] Implement `DoubaoService` wrapper for `https://ark.cn-beijing.volces.com/api/v3/responses`.
    - [ ] Create prompts for Question Generation.
    - [ ] Create prompts for Report Generation.
- [ ] **Database**:
    - [ ] Set up Supabase client.
    - [ ] Create `SessionModel` to interact with `sessions` table.
- [ ] **API Endpoints**:
    - [ ] `POST /api/init-session`: Create a session ID.
    - [ ] `POST /api/generate-questions`: Fetch blueprint -> Call AI -> Return questions -> Save to DB.
    - [ ] `POST /api/submit-answers`: Receive answers -> Calculate Score -> Identify Type -> Save to DB.
    - [ ] `POST /api/generate-report`: Fetch session data -> Call AI -> Return report -> Save to DB.

## Phase 3: Frontend Implementation
- [ ] **Components**:
    - [ ] `Layout` (Dark theme container).
    - [ ] `Button`, `Input`, `Card` (UI primitives).
    - [ ] `ProgressBar`.
- [ ] **Pages**:
    - [ ] `LandingPage`: Hero section + Start button.
    - [ ] `QuestionPage`: 
        - [ ] Render MCQ / Rank / ShortAnswer components.
        - [ ] Handle navigation between questions.
    - [ ] `LoadingPage`: "Analyzing personality..." animation.
    - [ ] `ReportPage`: Display sections (Surface, Deep, etc.).
    - [ ] `SharePage`: Render the "Personality Card" for export (using HTML2Canvas or similar if needed, or just CSS layout).
- [ ] **State Management**:
    - [ ] Create `useSessionStore` (current question, answers, scores, report).

## Phase 4: Integration & Polish
- [ ] Connect Frontend to Backend APIs.
- [ ] Test full flow: Landing -> Questions -> Answers -> Report.
- [ ] Refine AI prompts for better "stinging but true" tone.
- [ ] Optimize visual animations (Framer Motion).
- [ ] Verify Mobile Responsiveness.

## Phase 5: Final Review
- [ ] Check against all 20 personality types.
- [ ] Verify scoring math.
- [ ] Ensure error handling (AI failure, API errors).
