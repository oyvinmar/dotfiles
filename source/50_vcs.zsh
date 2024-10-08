
# Git shortcuts

alias g='git'
function ga() { git add "${@:-.}"; } # Add all files by default
alias gai='ga -i'
alias gp='git push'
alias gpf='git push --force'
alias gpup='gp --set-upstream origin $(gbs)'
alias gpa='gp --all'
alias gu='git pull'
alias gl='git lg'
alias gg='gl --decorate --oneline --graph --date-order --all'
alias gs='git st'
alias gst='gs'
alias gd='git diff'
alias gdc='gd --cached'
alias gm='git commit -m'
alias gma='git commit -am'
alias gam='git commit --amend -a --no-edit'
alias gmm='git merge master'
alias gamend='git commit --amend'
alias gb='git branch'
alias gba='git branch -a'
alias gbd='git-branch-delete'
alias fixup='git commit --amend -a --no-edit && git push --force'
alias grs='git reset --hard origin/$(gbs)'
alias sup='git branch --set-upstream-to origin/$(git rev-parse --abbrev-ref HEAD)' # Set upstream to origin/<current-branch>

function gsw() { git switch "${@:-master}"; } # Checkout master by default
# compdef _git gc=git-checkout

alias gsc='gsw --create'
alias gcl='git clone'
alias gfm='git fetch origin master:master'

# Current branch or SHA if detached.
alias gbs='git branch | perl -ne '"'"'/^\* (?:\(detached from (.*)\)|(.*))/ && print "$1$2"'"'"''

# Run commands in each subdirectory.
alias gu-all='eachdir git pull'
alias gp-all='eachdir git push'
alias gs-all='eachdir git status'

# Github shortcuts
alias list='gh pr list'

# GitHub URL for current repo.
function gurl() {
  local remotename="${@:-origin}"
  local remote="$(git remote -v | awk '/^'"$remotename"'.*\(push\)$/ {print $2}')"
  [[ "$remote" ]] || return
  local host="$(echo "$remote" | perl -pe 's/.*@//;s/:.*//')"
  local user_repo="$(echo "$remote" | perl -pe 's/.*://;s/\.git$//')"
  echo "https://$host/$user_repo"
}
# GitHub URL for current repo, including current branch + path.
alias gurlp='echo $(gurl)/tree/$(gbs)/$(git rev-parse --show-prefix)'

# git log with per-commit cmd-clickable GitHub URLs (iTerm)
function gf() {
  git log $* --name-status --color | awk "$(cat <<AWK
    /^.*commit [0-9a-f]{40}/ {sha=substr(\$2,1,7)}
    /^[MA]\t/ {printf "%s\t$(gurl)/blob/%s/%s\n", \$1, sha, \$2; next}
    /.*/ {print \$0}
AWK
  )" | less -F
}

# open last commit in GitHub, in the browser.
function gfu() {
  local n="${@:-1}"
  n=$((n-1))
  git web--browse  $(git log -n 1 --skip=$n --pretty=oneline | awk "{printf \"$(gurl)/commit/%s\", substr(\$1,1,7)}")
}
# open current branch + path in GitHub, in the browser.
alias gpu='git web--browse $(gurlp)'

# Just the last few commits, please!
for n in {1..5}; do alias gf$n="gf -n $n"; done

function gj() { git-jump "${@:-next}"; }
alias gj-='gj prev'
