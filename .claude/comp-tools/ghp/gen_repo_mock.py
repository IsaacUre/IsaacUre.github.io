#!/usr/bin/env python3
"""Builds data/repo.json, the repository-page fixtures for drive_more.js, from
real api.github.com answers saved outside the repo (they hold commit e-mails,
which never get committed). Only the fields the pages read are kept, and every
e-mail is dropped.

usage: python3 gen_repo_mock.py <dir of saved answers> <out json>
The dir holds what fetch_repo_api.sh saves (see README.md)."""
import json, os, re, sys

SRC, OUT = sys.argv[1], sys.argv[2]
def load(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f: return json.load(f)
def text(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f: return f.read()
def last_page(hname):                  # the Link header's rel="last" page, 0 if there is none
    m = re.search(r'[?&]page=(\d+)>;\s*rel="last"', text(hname), re.I)
    return int(m.group(1)) if m else 0

def commit(c):                         # what the pages read of a commit, and no e-mail
    a = c.get('author') or None
    cm = c['commit']
    return {'sha': c['sha'],
            'author': {'login': a['login'], 'id': a['id'], 'avatar_url': a['avatar_url']} if a else None,
            'commit': {'message': cm['message'],
                       'author': {'date': cm['author']['date']},
                       'committer': {'date': cm['committer']['date']},
                       'verification': {'verified': bool((cm.get('verification') or {}).get('verified'))}}}
def entry(e):
    return {k: e[k] for k in ('name', 'path', 'type', 'size', 'html_url') if k in e}

R = load('repo.json')
repo = {k: R.get(k) for k in ('name', 'full_name', 'private', 'visibility', 'fork', 'description', 'homepage', 'topics', 'default_branch', 'stargazers_count', 'forks_count',
                               'subscribers_count', 'open_issues_count', 'has_issues', 'has_projects', 'has_wiki', 'has_discussions', 'archived', 'is_template', 'pushed_at', 'created_at')}
repo['owner'] = {'login': R['owner']['login'], 'id': R['owner']['id'], 'avatar_url': R['owner']['avatar_url'], 'type': R['owner']['type']}
repo['license'] = {k: R['license'][k] for k in ('key', 'name', 'spdx_id')} if R.get('license') else None

paths = {}
for fn in sorted(os.listdir(os.path.join(SRC, 'pathc'))):
    lst = load(os.path.join('pathc', fn))
    if isinstance(lst, list) and lst: paths[fn] = commit(lst[0])
root = [entry(e) for e in load('contents_root.json')]
comp = [entry(e) for e in load('contents_comp.json')]
bypath = {}
for e in root + comp:
    k = e['path'].replace('/', '_') + '.json'
    if k in paths: bypath[e['path']] = paths[k]

def file(name):
    f = load(name)
    return {'type': f['type'], 'name': f['name'], 'path': f['path'], 'size': f['size'], 'encoding': f['encoding'], 'content': f['content']}

out = {
    'note': 'api.github.com answers for IsaacUre/IsaacUre.github.io, trimmed to what the pages read; made by gen_repo_mock.py',
    'repo': repo,
    'contents': {'': root, 'comp': comp},
    'files': {'CLAUDE.md': file('file_claude.json'), 'comp/index.html': file('file_compindex.json')},
    'html': {'CLAUDE.md': text('file_claude.html')},
    'head': commit(load('commits1.json')[0]), 'ncommits': last_page('h_commits1.txt'),
    'bypath': bypath,
    'commits35': [commit(c) for c in load('commits35.json')],
    'nbranches': last_page('h_branches.txt') or len(load('branches1.json')), 'ntags': last_page('h_tags.txt') or len(load('tags1.json')),
    'languages': load('languages.json'),
    'contributors': [{'login': p['login'], 'id': p['id'], 'avatar_url': p['avatar_url'], 'contributions': p['contributions']} for p in load('contributors.json')],
    'contributorsLast': last_page('h_contrib.txt'),
    'releases': [{'tag_name': x['tag_name'], 'name': x['name'], 'published_at': x['published_at'], 'prerelease': x['prerelease']} for x in load('releases1.json')],
    'releasesLast': last_page('h_rel.txt'),
    'pullsOpen': [{'number': p['number']} for p in load('pullsopen1.json')], 'pullsOpenLast': last_page('h_pulls.txt'),
}
s = json.dumps(out, ensure_ascii=False, indent=1)
# no e-mail but the two kinds GitHub itself publishes in commit trailers
for m in re.finditer(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+', s):
    if not (m.group(0) == 'noreply@anthropic.com' or m.group(0).endswith('@users.noreply.github.com')):
        sys.exit('refusing to write an e-mail address: ' + m.group(0))
with open(OUT, 'w', encoding='utf-8') as f: f.write(s + '\n')
print('wrote', OUT, len(s), 'bytes;', len(bypath), 'rows;', len(out['commits35']), 'commits')
