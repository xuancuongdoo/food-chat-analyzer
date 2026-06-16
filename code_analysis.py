#!/usr/bin/env python3
"""
code_analysis.py — Senior engineer code quality report for past week's commits.

Metrics:
  - Churn vs complexity (files changed often + large diffs)
  - Test coverage signal (test file changes vs src changes)
  - PR size discipline (lines per commit)
  - Dead code signal (deleted lines ratio, TODO/FIXME drift)
  - SOC layer mixing (commit touches multiple architectural layers)
  - SOC function-level (LLM analysis on flagged commits only)
  - Time estimation (session-based heuristic)

Output: terminal report + LLM senior engineer verdict (short, sharp).
"""

import os
import re
import subprocess
import json
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional
from openai import OpenAI

# ── Config ────────────────────────────────────────────────────────────────────
REPO   = "/Users/xuancuong/Documents/work/sippify"
AUTHOR = "64152374+xuancuongdoo@users.noreply.github.com"
DAYS   = 7
MODEL  = "gpt-4o"

# Architectural layers — map path prefix → layer name
LAYER_MAP = {
    "app/":           "routes",
    "components/":    "ui",
    "lib/":           "logic",
    "db/":            "data",
    "supabase/":      "data",
    "tests/":         "test",
    "scripts/":       "infra",
    "design-system/": "ui",
}

# Session gap: >= 2h between commits = new session; add 15min ramp-up
SESSION_GAP_SECONDS  = 2 * 3600
SESSION_RAMP_MINUTES = 15
MAX_SESSION_HOURS    = 4
# ──────────────────────────────────────────────────────────────────────────────


def run(cmd: str, cwd: str = REPO) -> str:
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
    return result.stdout.strip()


@dataclass
class CommitInfo:
    sha: str
    timestamp: int
    subject: str
    files_changed: list = field(default_factory=list)
    insertions: int = 0
    deletions: int = 0
    layers: set = field(default_factory=set)
    is_test_only: bool = False
    has_test_files: bool = False
    todo_drift: int = 0
    dead_code_signal: bool = False
    soc_mixed: bool = False


def get_commits():
    log = run(
        f'git log --since="{DAYS} days ago" --author="{AUTHOR}" '
        f'--format="%H|%at|%s" --no-merges'
    )
    if not log:
        return []

    commits = []
    for line in log.splitlines():
        sha, ts, subject = line.split("|", 2)
        commits.append(CommitInfo(sha=sha, timestamp=int(ts), subject=subject))
    return commits


def enrich_commits(commits):
    for c in commits:
        stat = run(f"git show --stat --format='' {c.sha}")
        c.insertions, c.deletions = parse_stat_summary(stat)
        c.files_changed = parse_changed_files(
            run(f"git diff-tree --no-commit-id -r --name-only {c.sha}")
        )

        layers = set()
        for f in c.files_changed:
            for prefix, layer in LAYER_MAP.items():
                if f.startswith(prefix):
                    layers.add(layer)
                    break
        c.layers = layers

        code_layers = layers - {"test", "infra"}
        c.soc_mixed = len(code_layers) >= 3

        test_files = [f for f in c.files_changed if "test" in f.lower() or f.startswith("tests/")]
        c.has_test_files = len(test_files) > 0
        c.is_test_only = len(test_files) == len(c.files_changed) and len(c.files_changed) > 0

        if c.deletions > 0 and c.insertions < c.deletions * 0.3 and not c.has_test_files:
            c.dead_code_signal = True

        diff = run(f"git show {c.sha} -- '*.ts' '*.tsx' '*.js'")
        added_todos   = len(re.findall(r'^\+.*\b(TODO|FIXME|HACK|XXX)\b', diff, re.MULTILINE))
        removed_todos = len(re.findall(r'^-.*\b(TODO|FIXME|HACK|XXX)\b', diff, re.MULTILINE))
        c.todo_drift = added_todos - removed_todos

    return commits


def parse_stat_summary(stat):
    m = re.search(r'(\d+) insertion', stat)
    ins = int(m.group(1)) if m else 0
    m = re.search(r'(\d+) deletion', stat)
    dels = int(m.group(1)) if m else 0
    return ins, dels


def parse_changed_files(output):
    return [l.strip() for l in output.splitlines() if l.strip()]


def estimate_hours(commits):
    if not commits:
        return 0.0
    timestamps = sorted(c.timestamp for c in commits)
    total_minutes = 0
    session_start = timestamps[0]
    prev = timestamps[0]

    for ts in timestamps[1:]:
        gap = ts - prev
        if gap >= SESSION_GAP_SECONDS:
            session_minutes = (prev - session_start) / 60 + SESSION_RAMP_MINUTES
            total_minutes += min(session_minutes, MAX_SESSION_HOURS * 60)
            session_start = ts
        prev = ts

    session_minutes = (prev - session_start) / 60 + SESSION_RAMP_MINUTES
    total_minutes += min(session_minutes, MAX_SESSION_HOURS * 60)
    return round(total_minutes / 60, 1)


def compute_churn(commits):
    file_changes = defaultdict(int)
    for c in commits:
        for f in c.files_changed:
            file_changes[f] += 1
    return dict(sorted(file_changes.items(), key=lambda x: -x[1])[:10])


def pick_soc_candidates(commits):
    return [c for c in commits if c.soc_mixed or (c.insertions + c.deletions) > 300]


def build_llm_payload(commits, soc_candidates, churn, hours):
    commit_summaries = []
    for c in commits:
        commit_summaries.append({
            "subject":       c.subject,
            "insertions":    c.insertions,
            "deletions":     c.deletions,
            "files_changed": len(c.files_changed),
            "layers_touched": sorted(c.layers),
            "has_tests":     c.has_test_files,
            "soc_mixed":     c.soc_mixed,
            "todo_drift":    c.todo_drift,
            "dead_code_signal": c.dead_code_signal,
        })

    soc_details = []
    for c in soc_candidates:
        soc_details.append({
            "subject":    c.subject,
            "layers":     sorted(c.layers),
            "insertions": c.insertions,
            "deletions":  c.deletions,
            "files":      len(c.files_changed),
        })

    total_ins    = sum(c.insertions for c in commits)
    total_dels   = sum(c.deletions for c in commits)
    test_ratio   = sum(1 for c in commits if c.has_test_files) / len(commits) if commits else 0
    avg_size     = (total_ins + total_dels) / len(commits) if commits else 0
    todo_drift   = sum(c.todo_drift for c in commits)
    dead_signals = sum(1 for c in commits if c.dead_code_signal)
    soc_viols    = sum(1 for c in commits if c.soc_mixed)

    return {
        "period_days":          DAYS,
        "total_commits":        len(commits),
        "estimated_hours":      hours,
        "avg_commit_size_lines": round(avg_size),
        "total_insertions":     total_ins,
        "total_deletions":      total_dels,
        "test_coverage_signal": round(test_ratio * 100),
        "todo_drift_net":       todo_drift,
        "dead_code_signals":    dead_signals,
        "soc_violations":       soc_viols,
        "top_churned_files":    list(churn.keys())[:5],
        "commits":              commit_summaries,
        "soc_flagged_commits":  soc_details,
    }


SYSTEM_PROMPT = """You are a senior software engineer with 15+ years of experience.
You value code quality above delivery speed. You are reviewing a week of commit metrics
for a single developer. Be ruthlessly honest but constructive.

Your verdict must be SHORT and SHARP:
1. **Overall Grade** (A/B/C/D) with one-line rationale
2. **Top 3 Risks** — what will bite this engineer in 30 days if not fixed
3. **One thing done well** — genuine praise only if earned
4. **Blunt recommendation** — one concrete action to take this week

Format: plain text, no fluff, no bullet padding. Speak directly to the engineer.
Max 250 words."""

USER_PROMPT_TEMPLATE = """Here are the commit metrics for the past {period_days} days:

SUMMARY:
- Commits: {total_commits}
- Estimated coding hours: {estimated_hours}h
- Avg commit size: {avg_commit_size_lines} lines
- Insertions: {total_insertions} | Deletions: {total_deletions}
- Commits with test files: {test_coverage_signal}%
- Net TODO/FIXME drift: {todo_drift_net} (positive = accumulating debt)
- Dead code removal signals: {dead_code_signals} commits (deletion-heavy, no tests)
- SOC violations (3+ layers in one commit): {soc_violations}
- Top churned files: {top_churned_files}

INDIVIDUAL COMMITS:
{commits_json}

SOC-FLAGGED COMMITS (mixed layers or large):
{soc_json}

Give your verdict."""


def call_llm(payload):
    client = OpenAI()
    commits_json = json.dumps(payload["commits"], indent=2)
    soc_json     = json.dumps(payload["soc_flagged_commits"], indent=2)

    user_msg = USER_PROMPT_TEMPLATE.format(
        period_days           = payload["period_days"],
        total_commits         = payload["total_commits"],
        estimated_hours       = payload["estimated_hours"],
        avg_commit_size_lines = payload["avg_commit_size_lines"],
        total_insertions      = payload["total_insertions"],
        total_deletions       = payload["total_deletions"],
        test_coverage_signal  = payload["test_coverage_signal"],
        todo_drift_net        = payload["todo_drift_net"],
        dead_code_signals     = payload["dead_code_signals"],
        soc_violations        = payload["soc_violations"],
        top_churned_files     = payload["top_churned_files"],
        commits_json          = commits_json,
        soc_json              = soc_json,
    )

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_msg},
        ],
        temperature=0.3,
        max_tokens=400,
    )
    return response.choices[0].message.content.strip()


def print_table(commits, hours, churn):
    print("\n" + "=" * 70)
    print(f"  SIPPIFY — WEEK IN CODE  |  {len(commits)} commits  |  ~{hours}h estimated")
    print("=" * 70)

    print(f"\n{'SHA':8}  {'INS':>5}  {'DEL':>5}  {'LAYERS':<28}  FLAGS")
    print("-" * 70)
    for c in commits:
        flags = []
        if c.soc_mixed:           flags.append("SOC!")
        if not c.has_test_files:  flags.append("no-test")
        if c.todo_drift > 0:      flags.append(f"TODO+{c.todo_drift}")
        if c.dead_code_signal:    flags.append("dead?")
        layer_str = ",".join(sorted(c.layers)) if c.layers else "—"
        flag_str  = " ".join(flags) if flags else "ok"
        print(f"{c.sha[:7]}  {c.insertions:>5}  {c.deletions:>5}  {layer_str:<28}  {flag_str}")
        print(f"         {c.subject[:62]}")

    if churn:
        print(f"\nTOP CHURNED FILES")
        print("-" * 50)
        for f, n in list(churn.items())[:5]:
            bar = "#" * min(n, 20)
            print(f"  {f[-45:]:<45}  {bar} ({n})")

    print()


def main():
    print("Collecting commits...")
    commits = get_commits()
    if not commits:
        print(f"No commits found in past {DAYS} days for {AUTHOR}")
        return

    print(f"Found {len(commits)} commits. Enriching...")
    commits = enrich_commits(commits)
    hours   = estimate_hours(commits)
    churn   = compute_churn(commits)
    soc_candidates = pick_soc_candidates(commits)

    print_table(commits, hours, churn)

    print("Sending to LLM for senior engineer verdict...\n")
    payload = build_llm_payload(commits, soc_candidates, churn, hours)
    verdict = call_llm(payload)

    print("=" * 70)
    print("  SENIOR ENGINEER VERDICT")
    print("=" * 70)
    print(verdict)
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()
