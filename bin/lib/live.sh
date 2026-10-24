# Shared by the bin/live-* scripts: the owner runs them by hand on the real account (docs/dev/live-scenarios.md).
# Every wa call goes to the main checkout's bin/wa, the one whose `serve` holds the device.
# shellcheck shell=sh disable=SC2016 # json takes JavaScript, whose ${} is its own

die() {
  echo "$*" >&2
  exit 1
}

root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
main=$(CDPATH='' cd -- "$(git -C "$root" rev-parse --path-format=absolute --git-common-dir)/.." && pwd) ||
  die "cannot find the main checkout from $root"
wa="$main/bin/wa"
[ -f "$main/dist/bin/wa.js" ] || die "no build in $main — run pnpm build there first"
[ -t 0 ] && [ -t 1 ] || die "run this from a terminal: it asks before every step"

# Machine mode, and never a question nobody sees: the script has asked before each write. A failure shows only its
# exit code and error code, because cli-core's JSON error names the chat and the message it was about.
wa_json() {
  errors=$(mktemp "${TMPDIR:-/tmp}/wa-live.XXXXXX") || return 1
  "$wa" "$@" --json --no-input 2>"$errors" && { rm -f -- "$errors"; return 0; }
  status=$?
  reason=$(head -n 1 -- "$errors" | json 'd.error.code' 2>/dev/null) || reason=""
  rm -f -- "$errors"
  echo "wa $(command_words "$@") failed: exit $status, ${reason:-no error code}" >&2
  return "$status"
}

# One wa call: its stdout in $out, its exit code in $rc. Its stderr stays in the caller's file $errs and is never
# printed whole, since a refusal can quote the chat. Not wa_json: that keeps only the error code, and a caller may
# need to read the refusal's fixed words.
attempt() {
  # shellcheck disable=SC2034,SC2154 # out and rc are the caller's to read, errs the caller's to set
  out=$("$wa" "$@" --json --no-input 2>"$errs") && rc=0 || rc=$?
}

# The error's code ("validation_error", "settings.keys-missing"), the one part of a refusal that is safe to print.
# A diagnostic line, such as download's "not a file", can come before the JSON error.
error_code() {
  grep -m 1 '^{' -- "$errs" | json 'd.error.code' 2>/dev/null
}

# The error's reason ("media.phone-timeout"), registered and fixed, so safe to print and to branch on (WC-OUT-15).
error_reason() {
  grep -m 1 '^{' -- "$errs" | json 'd.error.reason' 2>/dev/null
}

# The leading lowercase words of a call: its command. The arguments after them may be ids.
command_words() {
  shown=""
  for word in "$@"; do
    case "$word" in
      "" | -* | *[!a-z-]*) break ;;
    esac
    shown="$shown $word"
  done
  printf '%s' "${shown# }"
}

# Reads one JSON value on stdin and prints an expression over it (`d`), with `a` the optional second argument.
# The expression is always this script's own text; data reaches it only as `d` and `a`. A failure says nothing
# more, since Node's own error would quote the data.
json() {
  node -e '
    let text = ""
    process.stdin.on("data", (chunk) => (text += chunk)).on("end", () => {
      try {
        const value = new Function("d", "a", `return (${process.argv[1]})`)(JSON.parse(text), process.argv[2])
        if (value !== undefined && value !== null) console.log(value)
      } catch {
        console.error("no answer in the expected shape")
        process.exit(1)
      }
    })
  ' "$1" "${2:-}"
}

profiles() {
  wa_json account list --timeout 30s | json 'd.items.map((one) => one.profile).join(" ")'
}

# Never picks a profile: a missing or unknown one stops with the choices.
need_profile() {
  known=$(profiles) || die "wa account list failed"
  [ -n "${1:-}" ] || die "name the profile: $(basename -- "$0") <profile> — profiles here: ${known:-none}"
  case " $known " in
    *" $1 "*) ;;
    *) die "no profile $1 here — profiles here: ${known:-none}" ;;
  esac
}

# The account's own chat, as the profile recorded it at login. Kept in a variable by the caller; never printed.
own_chat() {
  own=$(wa_json account list --timeout 30s | json 'd.items.find((one) => one.profile === a)?.account' "$1")
  case "$own" in
    *@lid) printf '%s\n' "$own" ;;
    *) die "profile $1 has no recorded own id in LID form — run $wa $1 account show once" ;;
  esac
}

# The device lock as doctor reads it from disk, without connecting: "<holder>|<pid>|<running>".
lock_of() {
  wa_json "$1" doctor --timeout 30s 2>/dev/null |
    json '[d.item.whatsapp.lock.holder ?? "", d.item.whatsapp.lock.pid ?? "", d.item.whatsapp.lock.running].join("|")' \
      2>/dev/null
}

lock_held() {
  case "$(lock_of "$1")" in
    *"|true") return 0 ;;
    *) return 1 ;;
  esac
}

serve_running() {
  case "$(lock_of "$1")" in
    "serve (pid "*"|true") return 0 ;;
    *) return 1 ;;
  esac
}

# A closed terminal or a quit ends the script through its EXIT trap too; an untrapped signal would skip it.
on_signals() {
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 131' QUIT
  trap 'exit 143' TERM
}

# Uninterruptible: a second Ctrl-C half-way through putting serve back would leave the owner without it.
hold_signals() {
  trap '' HUP INT QUIT TERM
}

confirm() {
  printf '\n%s\nEnter to go on, Ctrl-C to stop: ' "$1"
  read -r _ || exit 130
}

# Asks until the answer is y or n; prints yes or no.
phone() {
  while :; do
    printf '%s [y/n] ' "$1" >&2
    read -r reply || exit 130
    case "$reply" in
      y | Y | yes) echo yes && return ;;
      n | N | no) echo no && return ;;
    esac
  done
}

# The profile's serve, from the lock: sets lock as read, engine and serve to the two PIDs, and serve_err to where
# serve's diagnostics go. Default-profile launches need an explicitly opted-in, persistent user service.
find_serve() {
  serve_unit=""
  serve_implicit=no
  lock=$(lock_of "$1")
  engine=$(echo "$lock" | cut -d'|' -f2)
  engine_args=$(ps -ww -o args= -p "$engine") || { echo "cannot read process $engine" >&2; return 1; }
  case "$engine_args" in
    *wa-engine" --store $main/.wa/state/profiles/$1/private.db --holder serve") ;;
    *) echo "process $engine holds the lock but is not wa's engine for serve — stopping nothing" >&2; return 1 ;;
  esac
  serve=$(ps -o ppid= -p "$engine" | tr -d ' ')
  serve_args=$(ps -ww -o args= -p "$serve") || { echo "cannot read process $serve" >&2; return 1; }
  # Only the one-shot regression opts into pausing the manager; logging/relink checks need their own launch.
  if [ "${2:-}" = --managed ]; then
    cgroup=$(cat "/proc/$serve/cgroup" 2>/dev/null) || cgroup=""
    candidate=${cgroup##*/}
    case "$candidate" in
      *.service)
        manager_pid=$(systemctl --user show "$candidate" --property=MainPID --value 2>/dev/null) || manager_pid=""
        if [ "$manager_pid" = "$serve" ]; then
          transient=$(systemctl --user show "$candidate" --property=Transient --value 2>/dev/null) || transient=""
          [ "$transient" = no ] || { echo "cannot restore a transient or unverified service — stopping nothing" >&2; return 1; }
          serve_unit=$candidate
        fi
        ;;
    esac
  fi
  case "$serve_args" in
    *" $main/dist/bin/wa.js $1 serve") ;;
    *" $main/dist/bin/wa.js serve")
      [ -n "$serve_unit" ] || { echo "a default-profile serve needs a verified persistent user service — stopping nothing" >&2; return 1; }
      service_profile_matches "$1" || return 1
      serve_implicit=yes
      ;;
    *)
      echo "serve (pid $serve) was not started as $wa $1 serve; this script could not start it again the same way" >&2
      return 1
      ;;
  esac
  # Where serve's diagnostics went, so the restarted one writes there too; a pipe or socket cannot be reopened.
  serve_err=/dev/null
  if target=$(readlink "/proc/$serve/fd/2" 2>/dev/null); then
    case "$target" in
      /*) [ -w "$target" ] && serve_err=$target ;;
    esac
  fi
  return 0
}

# The unit must explicitly preserve the profile and checkout paths when started again.
service_profile_matches() {
  systemctl --user show "$serve_unit" --property=Environment --value 2>/dev/null |
    node -e '
      let text = ""
      process.stdin.on("data", (chunk) => (text += chunk)).on("end", () => {
        // Refuse quoting/escapes rather than treating quoted content as another environment assignment.
        if (/["\\\x27]/.test(text)) process.exit(1)
        const env = new Map(text.trim().split(/\s+/).map((entry) => {
          const at = entry.indexOf("=")
          return [entry.slice(0, at), entry.slice(at + 1)]
        }))
        const [profile, main] = process.argv.slice(1)
        process.exit(env.get("WA_PROFILE") === profile && env.get("WA_STATE_DIR") === `${main}/.wa/state` &&
          env.get("WA_CONFIG_DIR") === `${main}/.wa/config` ? 0 : 1)
      })
    ' "$1" "$main" || { echo "the service profile or checkout environment cannot be verified — stopping nothing" >&2; return 1; }
}

# Stops the serve find_serve found, by its PID, once the lock still names it, and waits until both processes are gone
# and the lock is free. Sets stopped=yes just before the kill, for the caller's EXIT trap.
stop_serve() {
  [ "$(lock_of "$1")" = "$lock" ] && [ "$(ps -o ppid= -p "$engine" | tr -d ' ')" = "$serve" ] || {
    echo "serve changed while the plan was on screen — stopping nothing; run the script again" >&2
    return 1
  }
  [ "${serve_implicit:-no}" != yes ] || service_profile_matches "$1" || return 1
  # shellcheck disable=SC2034 # read by the caller's EXIT trap
  if [ -n "${serve_unit:-}" ]; then
    [ "$(systemctl --user show "$serve_unit" --property=MainPID --value)" = "$serve" ] || {
      echo "the service changed — stopping nothing" >&2; return 1;
    }
    stopped=yes
    systemctl --user --no-block stop -- "$serve_unit" || return 1
  else
    stopped=yes
    kill "$serve" || return 1
  fi
  tries=0
  while kill -0 "$serve" 2>/dev/null || kill -0 "$engine" 2>/dev/null; do
    tries=$((tries + 1))
    [ "$tries" -le 30 ] || { echo "serve (pid $serve) or its engine has not ended after 30 s" >&2; return 1; }
    sleep 1
  done
  if lock_held "$1"; then
    echo "something holds the lock again — a service manager may have restarted serve" >&2
    return 1
  fi
  echo "serve stopped, lock free"
}

# Starts serve as find_serve found it: from the main checkout, detached, stdout to /dev/null, diagnostics to
# serve_err, or through the verified user service. A second argument turns the engine's log on for direct
# launches (WA_ENGINE_LOG). Sets started to serve's
# PID and waits until serve holds the lock.
start_serve() {
  if [ -n "${serve_unit:-}" ]; then
    [ -z "${2:-}" ] || { echo "cannot change a managed serve's logging environment" >&2; return 1; }
    tries=0
    while lock_held "$1" && ! serve_running "$1"; do
      tries=$((tries + 1))
      [ "$tries" -le 30 ] || { echo "the one-shot still holds the lock after 30 s" >&2; return 1; }
      sleep 1
    done
    systemctl --user --no-block start -- "$serve_unit" || return 1
    tries=0
    until [ "$(systemctl --user show "$serve_unit" --property=ActiveState --value)" = active ] && serve_running "$1"; do
      tries=$((tries + 1))
      [ "$tries" -le 60 ] || { echo "the service does not hold the lock after 60 s" >&2; return 1; }
      sleep 1
    done
    started=$(systemctl --user show "$serve_unit" --property=MainPID --value)
    echo "serve holds the lock again through its user service"
    return 0
  fi
  # A one-shot cut short by Ctrl-C may hold the lock for a moment; serve started now would be refused it.
  tries=0
  while lock_held "$1"; do
    tries=$((tries + 1))
    [ "$tries" -le 30 ] || { echo "the lock is still held after 30 s — start $wa $1 serve yourself" >&2; return 1; }
    sleep 1
  done
  umask 077
  # Its own session, so a Ctrl-C at a later prompt reaches the script and not serve.
  (
    cd -- "$main" || exit 1
    [ -z "${2:-}" ] || export WA_ENGINE_LOG="$2"
    if command -v setsid >/dev/null; then
      exec setsid nohup "$wa" "$1" serve </dev/null >/dev/null 2>>"$serve_err"
    fi
    exec nohup "$wa" "$1" serve </dev/null >/dev/null 2>>"$serve_err"
  ) &
  started=$!
  if [ -n "${2:-}" ]; then
    echo "started serve (pid $started) with the engine's log on, its diagnostics to $serve_err as before"
  else
    echo "started serve again (pid $started), its diagnostics to $serve_err as before"
  fi
  tries=0
  until serve_running "$1"; do
    tries=$((tries + 1))
    [ "$tries" -le 60 ] || { echo "serve does not hold the lock after 60 s" >&2; return 1; }
    sleep 1
  done
  echo "serve holds the lock again"
}

# Puts back the serve stop_serve stopped, and never as a second serve while the stopped one, or one an earlier try
# started, still lives. Done only once serve holds the lock, so a failed try is retried by the EXIT trap. The caller
# holds signals around it (hold_signals).
restore_serve() {
  [ "$stopped" = yes ] || return 0
  if [ -n "${serve_unit:-}" ]; then
    start_serve "$1" || return 1
    stopped=no
    return 0
  fi
  for pid in "$serve" "$started"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo "serve (pid $pid) is still running — not starting a second one" >&2
      return 0
    fi
  done
  start_serve "$1" || return 1
  stopped=no
}
