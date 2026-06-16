#!/usr/bin/env python3
"""
code_analysis.py -- Senior engineer code quality report for recent commits.

Usage:
  python3 code_analysis.py                           # current dir, 7 days, all authors
  python3 code_analysis.py --repo /path/to/repo
  python3 code_analysis.py --author you@email.com
  python3 code_analysis.py --days 14
  python3 code_analysis.py --model gpt-4o
"""

import argparse
import os
import re
import subprocess
import json
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional
from openai import OpenAI

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

SESSION_GAP_SECONDS  = 2 * 3600
SESSION_RAMP_MINUTES = 15
MAX_SESSION_HOURS    = 4
DEFAULT_MODEL        = "gpt-4o-mini"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analyze git commit quality for the past N days.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 code_analysis.py
  python3 code_analysis.py --repo ~/projects/myapp --days 14
  python3 code_analysis.py --author alice@example.com
  python3 code_analysis.py --model gpt-4o
        """,
    )
    parser.add_argument("--repo",   default=None, help="Git repo path (default: cwd)")
    parser.add_argument("--author", default=None, help="Filter by author email/name")
    parser.add_argument("--days",   type=int, default=7, help="Days to look back (default: 7)")
    parser.add_argument("--model",  default=DEFAULT_MODEL, help=f"OpenAI model (default: {DEFAULT_MODEL})")
    return parser.parse_args()


def resolve_repo(path: Optional[str]) -> str:
    return os.path.expanduser(path) if path else os.getcwd()


def run(cmd: str, cwd: str) -> str:
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


def get_commits(repo: str, author: Optional[str], days: int):
    author_flag = f'--author="{author}"' if author else ""
    log = run(
        f'git log --since="{days} days ago" {author_flag} --format="%H|%at|%s" --no-merges',
        cwd=repo,
    )
    if not log:
        return []
    commits = []
    for line in log.splitlines():
        parts = line.split("|", 2)
        if len(parts) != 3:
            continue
        sha, ts, subject = parts
        commits.append(CommitInfo(sha=sha, timestamp=int(ts), subject=subject))
    return commits


def enrich_commits(commits, repo: str):
    for c in commits:
        stat = run(f"git show --stat --format='' {c.sha}", cwd=repo)
        c.insertions, c.deletions = parse_stat_summary(stat)
        c.files_changed = parse_changed_files(
            run(f"git diff-tree --no-commit-id -r --name-only {c.sha}", cwd=repo)
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
        c.has_test_files = bool(test_files)
        c.is_test_only = len(test_files) == len(c.files_changed) and bool(c.files_changed)

        if c.deletions > 0 and c.insertions < c.deletions * 0.3 and not c.has_test_files:
            c.dead_code_signal = True

        diff = run(f"git show {c.sha} -- '*.ts' '*.tsx' '*.js' '*.py'", cwd=repo)
        c.todo_drift = (
            len(re.findall(r'^\+.*(TODO|FIXME|HACK|XXX)', diff, re.MULTILINE))
            - len(re.findall(r'^-.*(TODO|FIXME|HACK|XXX)', diff, re.MULTILINE))
        )
    return commits


def parse_stat_summary(stat):
    ins  = int(m.group(1)) if (m := re.search(r"(\d+) insertion", stat)) else 0
    dels = int(m.group(1)) if (m := re.search(r"(\d+) deletion", stat)) else 0
    return ins, dels


def parse_changed_files(output):
    return [l.strip() for l in output.splitlines() if l.strip()]


def estimate_hours(commits):
    if not commits:
        return 0.0
    timestamps = sorted(c.timestamp for c in commits)
    total_minutes, session_start, prev = 0, timestamps[0], timestamps[0]
    for ts in timestamps[1:]:
        if ts - prev >= SESSION_GAP_SECONDS:
            total_minutes += min((prev - session_start) / 60 + SESSION_RAMP_MINUTES, MAX_SESSION_HOURS * 60)
            session_start = ts
        prev = ts
    total_minutes += min((prev - session_start) / 60 + SESSION_RAMP_MINUTES, MAX_SESSION_HOURS * 60)
    return round(total_minutes / 60, 1)


def compute_churn(commits):
    file_changes: dict = defaultdict(int)
    for c in commits:
        for f in c.files_changed:
            file_changes[f] += 1
    return dict(sorted(file_changes.items(), key=lambda x: -x[1])[:10])


def pick_soc_candidates(commits):
    return [c for c in commits if c.soc_mixed or (c.insertions + c.deletions) > 300]


def build_llm_payload(commits, soc_candidates, churn, hours, days):
    total_ins  = sum(c.insertions for c in commits)
    total_dels = sum(c.deletions for c in commits)
    test_ratio = sum(1 for c in commits if c.has_test_files) / len(commits) if commits else 0

    return {
        "period_days":           days,
        "total_commits":         len(commits),
        "estimated_hours":       hours,
        "avg_commit_size_lines": round((total_ins + total_dels) / len(commits)) if commits else 0,
        "total_insertions":      total_ins,
        "total_deletions":       total_dels,
        "test_coverage_signal":  round(test_ratio * 100),
        "todo_drift_net":        sum(c.todo_drift for c in commits),
        "dead_code_signals":     sum(1 for c in commits if c.dead_code_signal),
        "soc_violations":        sum(1 for c in commits if c.soc_mixed),
        "top_churned_files":     list(churn.keys())[:5],
        "commits": [
            {
                "subject":        c.subject,
                "insertions":     c.insertions,
                "deletions":      c.deletions,
                "files_changed":  len(c.files_changed),
                "layers_touched": sorted(c.layers),
                "has_tests":      c.has_test_files,
                "soc_mixed":      c.soc_mixed,
                "todo_drift":     c.todo_drift,
                "dead_code_signal": c.dead_code_signal,
            }
            for c in commits
        ],
        "soc_flagged_commits": [
            {
                "subject":    c.subject,
                "layers":     sorted(c.layers),
                "insertions": c.insertions,
                "deletions":  c.deletions,
                "files":      len(c.files_changed),
            }
            for c in soc_candidates
        ],
    }


SYSTEM_PROMPT = (
    "You are a senior software engineer with 15+ years of experience. "
    "You value code quality above delivery speed. You are reviewing recent commit metrics "
    "for a developer. Be ruthlessly honest but constructive.\n\n"
    "Your verdict must be SHORT and SHARP:\n"
    "1. **Overall Grade** (A/B/C/D) with one-line rationale\n"
    "2. **Top 3 Risks** -- what will bite this engineer in 30 days if not fixed\n"
    "3. **One thing done well** -- genuine praise only if earned\n"
    "4. **Blunt recommendation** -- one concrete action to take this week\n\n"
    "Format: plain text, no fluff. Speak directly to the engineer. Max 250 words."
)


def call_llm(payload, model: str) -> str:
    client = OpenAI()
    user_msg = (
        f"Commit metrics for the past {payload['period_days']} days:\n\n"
        f"Commits: {payload['total_commits']}  |  "
        f"Hours: ~{payload['estimated_hours']}h  |  "
        f"Avg size: {payload['avg_commit_size_lines']} lines\n"
        f"Ins: {payload['total_insertions']}  Del: {payload['total_deletions']}\n"
        f"Test signal: {payload['test_coverage_signal']}%  |  "
        f"TODO drift: {payload['todo_drift_net']}  |  "
        f"Dead code: {payload['dead_code_signals']}  |  "
        f"SOC viols: {payload['soc_violations']}\n"
        f"Top churned: {payload['top_churned_files']}\n\n"
        f"COMMITS:\n{json.dumps(payload['commits'], indent=2)}\n\n"
        f"SOC-FLAGGED:\n{json.dumps(payload['soc_flagged_commits'], indent=2)}\n\n"
        "Give your verdict."
    )
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_msg},
        ],
        temperature=0.3,
        max_tokens=400,
    )
    return response.choices[0].message.content.strip()


def print_table(commits, hours, churn, repo: str):
    name = os.path.basename(os.path.abspath(repo)).upper()
    print("\n" + "=" * 70)
    print(f"  {name} -- WEEK IN CODE  |  {len(commits)} commits  |  ~{hours}h estimated")
    print("=" * 70)
    print(f"\n{'SHA':8}  {'INS':>5}  {'DEL':>5}  {'LAYERS':<28}  FLAGS")
    print("-" * 70)
    for c in commits:
        flags = []
        if c.soc_mixed:          flags.append("SOC!")
        if not c.has_test_files: flags.append("no-test")
        if c.todo_drift > 0:     flags.append(f"TODO+{c.todo_drift}")
        if c.dead_code_signal:   flags.append("dead?")
        layer_str = ",".join(sorted(c.layers)) or "--"
        print(f"{c.sha[:7]}  {c.insertions:>5}  {c.deletions:>5}  {layer_str:<28}  {' '.join(flags) or 'ok'}")
        print(f"         {c.subject[:62]}")
    if churn:
        print("\nTOP CHURNED FILES")
        print("-" * 50)
        for f, n in list(churn.items())[:5]:
            print(f"  {f[-45:]:<45}  {'#' * min(n, 20)} ({n})")
    print()


def main():
    args   = parse_args()
    repo   = resolve_repo(args.repo)

    if not os.path.isdir(os.path.join(repo, ".git")):
        print(f"Error: {repo!r} is not a git repository.")
        raise SystemExit(1)

    if not os.environ.get("OPENAI_API_KEY"):
        print("Error: OPENAI_API_KEY environment variable is not set.")
        raise SystemExit(1)

    print(f"Repo  : {repo}")
    print(f"Window: {args.days} days" + (f"  |  Author: {args.author}" if args.author else ""))
    print("Collecting commits...")

    commits = get_commits(repo, args.author, args.days)
    if not commits:
        print(f"No commits found in past {args.days} days.")
        return

    print(f"Found {len(commits)} commits. Enriching...")
    commits        = enrich_commits(commits, repo)
    hours          = estimate_hours(commits)
    churn          = compute_churn(commits)
    soc_candidates = pick_soc_candidates(commits)

    print_table(commits, hours, churn, repo)

    print(f"Sending to LLM ({args.model}) for verdict...\n")
    payload = build_llm_payload(commits, soc_candidates, churn, hours, args.days)
    verdict = call_llm(payload, args.model)

    print("=" * 70)
    print("  SENIOR ENGINEER VERDICT")
    print("=" * 70)
    print(verdict)
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()
