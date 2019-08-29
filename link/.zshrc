export DOTFILES=~/.dotfiles

# fpath
fpath=($DOTFILES/zfunctions $DOTFILES/vendor/zsh-completions/src $fpath)

# Source all files in "source"
function src() {
  local file
  # Source all .sh and .zsh files
  for file ($DOTFILES/source/*sh); do
    source $file
  done
}

# Run dotfiles script, then source.
function dotfiles() {
  $DOTFILES/bin/dotfiles "$@" && src
}

src

#------------------------------------------------

# Needs to be here to prevent volta install script from readding it
export VOLTA_HOME="$HOME/.volta"
[ -s "$VOLTA_HOME/load.sh" ] && . "$VOLTA_HOME/load.sh"

export PATH="$VOLTA_HOME/bin:$PATH"