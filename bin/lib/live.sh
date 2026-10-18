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

# Machine mode, and never a question nobody sees: the script has asked before each write.
wa_json() {
  "$wa" "$@" --json --no-input
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

serve_running() {
  case "$(lock_of "$1")" in
    "serve (pid "*"|true") return 0 ;;
    *) return 1 ;;
  esac
}

confirm() {
  printf '\n%s\nEnter to go on, Ctrl-C to stop: ' "$1"
  read -r _ || exit 130
}
