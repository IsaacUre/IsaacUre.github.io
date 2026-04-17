# Claude working notes for IsaacUre.github.io

## Workflow

- When a task on a feature branch is complete, automatically create a PR against `main` (if one does not already exist for the branch) and squash-merge it. The user has standing approval for auto-merge on this repo.
- If the branch already has a prior merged PR at an older commit, open a new PR for the new commits and squash-merge that.
