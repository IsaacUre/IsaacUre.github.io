#!/usr/bin/env python3
"""Mock data for the GitHub-profile harness, from the real API answers saved in APIDATA (see README.md).
usage: gen_mock.py AS_OF_ISO OUTDIR APIDATA   (e.g. 2026-09-24T18:09:53Z data /tmp/apidata)
Writes OUTDIR/mockdata.json (commits and pulls as they stood at AS_OF) and
OUTDIR/ghsnap.json (the calendar GitHub would draw at AS_OF, by GitHub's rules)."""
import json, glob, sys, os
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
AS_OF, OUT, APIDATA = sys.argv[1], sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__))
TZ = ZoneInfo('America/Chicago')
def iso(s): return datetime.strptime(s, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)
asof = iso(AS_OF)
def day(s): return iso(s).astimezone(TZ).strftime('%Y-%m-%d')
C = sum([json.load(open(f)) for f in sorted(glob.glob(APIDATA + '/commits_*.json'))], [])
P = sum([json.load(open(f)) for f in sorted(glob.glob(APIDATA + '/pulls_*.json'))], [])
commits = [{'sha': c['sha'][:12], 'author': {'login': c['author']['login']} if c.get('author') else None, 'commit': {'author': {'date': c['commit']['author']['date']}}}
           for c in C if iso(c['commit']['author']['date']) <= asof]
pulls = []
for p in P:
    if iso(p['created_at']) > asof: continue
    merged = p.get('merged_at') and iso(p['merged_at']) <= asof
    closed = p.get('closed_at') and iso(p['closed_at']) <= asof
    pulls.append({'number': p['number'], 'user': {'login': p['user']['login']}, 'created_at': p['created_at'],
                  'state': 'closed' if (merged or closed) else 'open', 'merged_at': p['merged_at'] if merged else None})
today = asof.astimezone(TZ).date()
start = today - timedelta(days=(today.weekday() + 1) % 7 + 364)
counts = {}
def add(d): counts[d] = counts.get(d, 0) + 1
for c in commits:
    if c['author'] and c['author']['login'] == 'IsaacUre': add(day(c['commit']['author']['date']))
for p in pulls:
    if p['user']['login'] == 'IsaacUre': add(day(p['created_at']))
add(day('2026-04-01T21:39:53Z'))                       # IsaacUre.github.io created
add(day('2026-09-01T19:30:00Z'))                       # the fork, as the harness mocks it
arr, d = [], start
while d <= today:
    arr.append(counts.get(d.strftime('%Y-%m-%d'), 0)); d += timedelta(days=1)
mk = today.strftime('%Y-%m')
mc = [c for c in commits if c['author'] and c['author']['login'] == 'IsaacUre' and day(c['commit']['author']['date']).startswith(mk)]
mp = [p for p in pulls if p['user']['login'] == 'IsaacUre' and day(p['created_at']).startswith(mk)]
snap = {'asOf': AS_OF, 'start': start.strftime('%Y-%m-%d'), 'today': today.strftime('%Y-%m-%d'), 'total': sum(arr), 'max': max(arr), 'counts': arr,
        'month': mk, 'monthCommits': len(mc), 'monthPRs': len(mp), 'monthMerged': sum(1 for p in mp if p['merged_at']), 'monthOpen': sum(1 for p in mp if p['state'] == 'open'),
        'repoPushed': max(c['commit']['author']['date'] for c in commits), 'repoCreated': '2026-04-01T21:39:53Z',
        'nCommits': sum(1 for c in commits if c['author'] and c['author']['login'] == 'IsaacUre'), 'nPRs': sum(1 for p in pulls if p['user']['login'] == 'IsaacUre')}
os.makedirs(OUT, exist_ok=True)
json.dump({'commits': commits, 'pulls': pulls}, open(OUT + '/mockdata.json', 'w'))
json.dump(snap, open(OUT + '/ghsnap.json', 'w'))
print({k: v for k, v in snap.items() if k != 'counts'}, len(commits), len(pulls))
