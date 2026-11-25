# Claude Code skill pack: a curated set of skills from mattpocock/skills and
# pstack, vendored and dependency-resolved, symlinked into ~/.claude/skills so
# they are available in every directory. See https://github.com/oyvinmar/fleet
#
# Runs after 50_mise.sh, which is what provides node and npm.

fleet_repo="git@github.com:oyvinmar/fleet.git"
fleet_dir="$HOME/develop/personal/fleet"

if [[ ! "$(type -P npm)" ]]; then
  e_error "npm not found, skipping the Claude skill pack. Run mise install first."
else
  if [[ -d "$fleet_dir/.git" ]]; then
    e_arrow "Updating Claude skill pack"
    if [[ -n "$(git -C "$fleet_dir" status --porcelain)" ]]; then
      e_error "$fleet_dir has uncommitted changes, not pulling. Linking what is there."
    elif ! git -C "$fleet_dir" pull --ff-only --quiet; then
      e_error "Could not fast-forward $fleet_dir. Resolve it by hand, then re-run."
    fi
  else
    e_arrow "Cloning Claude skill pack into ${fleet_dir/#$HOME/~}"
    mkdir -p "$(dirname "$fleet_dir")"
    git clone --quiet "$fleet_repo" "$fleet_dir" || e_error "Could not clone $fleet_repo."
  fi

  if [[ -f "$fleet_dir/package.json" ]]; then
    # Symlinks every vendored skill into ~/.claude/skills, prunes stale links,
    # then health-checks the result. Needs no network.
    (cd "$fleet_dir" && npm run --silent install-local)
  fi
fi

unset fleet_repo fleet_dir
