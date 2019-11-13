# Editing

export EDITOR=nvim

# If mvim is installed, use it instead of native vim
if [[ "$(which mvim)" =~ mvim$ ]]; then
   EDITOR="mvim -v"
   alias vim="$EDITOR"
fi


export VISUAL="$EDITOR"

function q() {
  if [[ -t 0 ]]; then
    $EDITOR "$@"
  else
    # Read from STDIN (and hide the annoying "Reading from stdin..." message)
    $EDITOR - > /dev/null
  fi
}
alias qs="q $DOTFILES"

# For when you have vim on the brain
alias :q=exit
