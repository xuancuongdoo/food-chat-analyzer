# FoodChat + Code Analyzer

Two tools in one repo:

1. **FoodChat** — upload a food photo, get an FDA-style nutrition label, then chat with GPT-4o about it
2. **code_analysis.py** — analyze your git history for the past week and get a senior engineer verdict on your code quality

---

## Prerequisites — do this once

### 1. Authenticate GitHub CLI

```bash
gh auth login
# Follow prompts: GitHub.com -> HTTPS -> paste a browser token
```

Verify:
```bash
gh auth status
```

### 2. Get an OpenAI API key

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create a new key with **GPT-4o** access
3. Copy the key (shown once — save it)

---

## FoodChat

### What it does

- Upload any food photo (or nutrition label photo)
- GPT-4o reads it and returns structured nutrition data
- Renders an FDA-style nutrition facts panel
- Opens a chat assistant pre-loaded with the nutrition context

### Prerequisites

- Node.js 18+
- An OpenAI API key with GPT-4o access

### Setup

```bash
# 1. Clone
git clone https://github.com/xuancuongdoo/food-chat-analyzer.git
cd food-chat-analyzer

# 2. Install dependencies
npm install

# 3. Add your OpenAI key
cp .env.example .env.local
# then edit .env.local and set OPENAI_API_KEY=sk-...

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 |
| AI | GPT-4o via OpenAI SDK |
| Language | TypeScript |

### Project layout

```
app/
  page.tsx              # Main UI
  api/
    analyze/route.ts    # POST /api/analyze — image -> nutrition JSON
    chat/route.ts       # POST /api/chat    — streaming chat
components/
  ImageUpload.tsx       # Drag-and-drop / click-to-upload
  NutritionLabel.tsx    # FDA-style nutrition facts panel
  ChatInterface.tsx     # Chat window with streaming
lib/
  openai.ts             # OpenAI client singleton
  config.ts             # Env validation + constants
  prompts.ts            # System prompts
types/
  nutrition.ts          # NutritionData interface
```

### API routes

| Route | Method | Input | Output |
|-------|--------|-------|--------|
| `/api/analyze` | POST | `multipart/form-data` with `image` field | `NutritionData` JSON |
| `/api/chat` | POST | `{ messages, nutritionContext, foodName }` | streaming plain text |

---

## code_analysis.py

Analyzes your git commits from the past N days and produces a terminal report + LLM verdict from a simulated senior engineer.

### What it checks

| Metric | What it flags |
|--------|---------------|
| Churn | Files changed frequently across commits |
| PR size discipline | Avg lines per commit |
| Test signal | % of commits that touch test files |
| TODO/FIXME drift | Net new debt markers added |
| Dead code signal | Deletion-heavy commits with no tests |
| SOC violations | Commits touching 3+ architectural layers |
| Time estimate | Session-based heuristic (2h gap = new session) |

### Prerequisites

- Python 3.9+
- `openai` package

```bash
pip install openai
# or
uv pip install openai
```

### Usage

```bash
# Analyze current directory repo (past 7 days, all authors)
python3 code_analysis.py

# Specify repo, author, and day window
python3 code_analysis.py --repo /path/to/repo --author "you@email.com" --days 14

# Just the last 3 days
python3 code_analysis.py --days 3

# All options
python3 code_analysis.py --help
```

OPENAI_API_KEY must be set:

```bash
export OPENAI_API_KEY=sk-...
python3 code_analysis.py
```

### Output example

```
======================================================================
  your-repo - WEEK IN CODE  |  23 commits  |  ~18.5h estimated
======================================================================

SHA       INS    DEL  LAYERS                        FLAGS
----------------------------------------------------------------------
a1b2c3d   142     38  logic,routes,ui               SOC!
          feat: add checkout flow

SENIOR ENGINEER VERDICT
======================================================================
Grade: B  -- solid output but layer discipline is slipping.
```

---

## Environment variables

| Variable | Required | Used by |
|----------|----------|---------|
| `OPENAI_API_KEY` | Yes | FoodChat (`.env.local`) + `code_analysis.py` (env) |

Never commit `.env.local`.

---

## npm scripts

```bash
npm run dev      # Start dev server -> http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```
