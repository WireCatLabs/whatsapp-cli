# Cleanup

- `/var/tmp/claude/claude-1000/-home-leemour-Projects-AI-whatsapp-cli/015ff043-7cb1-42bf-a5e1-a2a816f09c6c/scratchpad/community-main` — detached worktree of `community` at `origin/main`, used once to run `adopt-standards.py`; remove with `git -C /home/leemour/Projects/AI/community worktree remove <path>`. 2026-10-16
- `~/.local/share/whatsapp-cli/probe/` — the wa-probe's linked-device keys and totals; it sits inside the future state dir of `wa`. Remove after unlinking the device. 2026-10-16
- Manual: on the phone, WhatsApp → Settings → Linked devices → remove the probe's device (labelled "WhatsApp CLI"). 2026-10-16
- `~/go/pkg/mod` — whatsmeow and its dependencies downloaded for the spike and the probe (Go module cache; `go clean -modcache` clears all of it). 2026-10-16
- `/var/tmp/claude/claude-1000/-home-leemour-Projects-AI-whatsapp-cli/015ff043-7cb1-42bf-a5e1-a2a816f09c6c/scratchpad/{wm-spike,probe-test,probe-test2,clones}` — spike, probe test dirs and research clones. 2026-10-16
