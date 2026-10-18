# Cleanup

- `/var/tmp/claude/claude-1000/-home-leemour-Projects-AI-whatsapp-cli/015ff043-7cb1-42bf-a5e1-a2a816f09c6c/scratchpad/community-main` — detached worktree of `community` at `origin/main`, used once to run `adopt-standards.py`; remove with `git -C /home/leemour/Projects/AI/community worktree remove <path>`. 2026-10-16
- `~/.local/share/whatsapp-cli/probe/` — the wa-probe's linked-device keys and totals; it sits inside the future state dir of `wa`. Remove after unlinking the device. 2026-10-16
- Manual: on the phone, WhatsApp → Settings → Linked devices → remove the probe's device (labelled "WhatsApp CLI"). 2026-10-16
- `~/go/pkg/mod` — whatsmeow and its dependencies downloaded for the spike and the probe (Go module cache; `go clean -modcache` clears all of it). 2026-10-16
- `/var/tmp/claude/claude-1000/-home-leemour-Projects-AI-whatsapp-cli/015ff043-7cb1-42bf-a5e1-a2a816f09c6c/scratchpad/{wm-spike,probe-test,probe-test2,clones}` — spike, probe test dirs and research clones. 2026-10-16
- `/var/tmp/claude/claude-1000/-home-leemour-Projects-AI-whatsapp-cli/015ff043-7cb1-42bf-a5e1-a2a816f09c6c/scratchpad/docs_ai-public` — copy of the public docs_ai taken before the move to cli-private (now pushed there). 2026-10-16
- `.wa/state/profiles/live/` — copy of the probe device's keys, used for the 2026-10-17 live check of the engine. After it goes, unlink "Chrome (Linux)" on the phone too (it is the probe device). 2026-10-17
- `~/.local/share/whatsapp-cli/probe/session.db` — now stale: the `live` copy moved on from it; never run the probe on it again. 2026-10-17
- `/var/tmp/claude/claude-1000/-home-leemour-Projects-AI-whatsapp-cli/015ff043-7cb1-42bf-a5e1-a2a816f09c6c/scratchpad/{engtest,engtest2,serve.out,serve.err,serve.pid,engine.log,help.new,send.out,peek.test.ts}` — engine smoke-test leftovers. 2026-10-17
- `.github/workflows/engine-pr.yml` — redundant since `pr.yml` runs full validation (its `engine` job) on every PR. 2026-10-18
