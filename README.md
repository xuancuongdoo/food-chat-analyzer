# FoodChat + Code Analyzer

Two tools, one repo.

---

## Setup (do this first)

**1. Clone**
```bash
git clone https://github.com/xuancuongdoo/food-chat-analyzer.git
cd food-chat-analyzer
```

**2. Get an OpenAI API key**
- Go to https://platform.openai.com/api-keys and create a key with GPT-4o access.

**3. Add your key**
```bash
cp .env.example .env.local
# open .env.local and set: OPENAI_API_KEY=sk-...
```

---

## FoodChat (web app)

Upload a food photo → get an FDA-style nutrition label → chat with GPT-4o about it.

**Run:**
```bash
npm install
npm run dev
```
Open http://localhost:3000.

**How it works:**
1. Drop or click to upload a food photo
2. GPT-4o analyzes it and returns structured nutrition data
3. A chat assistant opens, pre-loaded with the nutrition context — ask anything

---

## code_analysis.py (CLI script)

Analyzes your git commits for the past N days. Prints a terminal report and gets a senior engineer verdict from GPT.

**Install dependency:**
```bash
pip install openai
```

**Run:**
```bash
# current repo, last 7 days
python3 code_analysis.py

# options
python3 code_analysis.py --repo /path/to/repo --author you@email.com --days 14 --model gpt-4o

python3 code_analysis.py --help
```

`OPENAI_API_KEY` must be in your environment:
```bash
export OPENAI_API_KEY=sk-...
```

**What it checks:** commit size, test coverage signal, TODO drift, churn hot spots, layer mixing (SOC violations), estimated coding hours.

---

## Environment

| Variable | Where |
|----------|-------|
| `OPENAI_API_KEY` | `.env.local` (web app) or shell env (script) |

Never commit `.env.local`.
