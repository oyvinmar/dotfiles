# Changing/making/removing directory
setopt auto_pushd
setopt pushd_ignore_dups
setopt pushdminus

alias -g ..='../'
alias -g ...='../..'
alias -g ....='../../..'
alias -g .....='../../../..'
alias -g ......='../../../../..'

alias -- -='cd -'
alias 1='cd -'
alias 2='cd -2'
alias 3='cd -3'
alias 4='cd -4'
alias 5='cd -5'
alias 6='cd -6'
alias 7='cd -7'
alias 8='cd -8'
alias 9='cd -9'

#alias md='mkdir -p'
alias rd=rmdir
alias d='dirs -v | head -10'

alias ls='exa'
# List directory contents
alias lsa='exa -lah'
alias l='exa -lah'
alias ll='exa -lh'
alias la='exa -lah'


if [[ "$(which tree)" =~ tree$ ]]; then
  alias t='tree --dirsfirst -C'
  alias ta='tree --dirsfirst -Ca'
  alias td='tree --dirsfirst -Cd'
fi

# Recursively delete `.DS_Store` files
alias dsstore="find . -name '*.DS_Store' -type f -ls -delete"

# Aliasing eachdir like this allows you to use aliases/functions as commands.
alias eachdir=". eachdir"

# Create a new directory and enter it
function md() {
  mkdir -p "$@" && cd "$@"
}