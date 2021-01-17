export DOTFILES=~/.dotfiles

# fpath
fpath=($DOTFILES/zfunctions $DOTFILES/vendor/zsh-completions/src $fpath)

# Source all files in "source"
function src() {
  local file

  # local file
  if [[ "$1" ]]; then
    source "$DOTFILES/source/$1"
  else
    # Source all .sh and .zsh files
    for file ($DOTFILES/source/*sh); do
      source $file
    done
  fi
}

# Run dotfiles script, then source.
function dotfiles() {
  $DOTFILES/bin/dotfiles "$@" && src
}

src

#------------------------------------------------

# Node.js doesn't provide arm binaries yet.
# So temporarly skip volta and use homebrew provided arm node distribution
if [[ is_macos_arm -eq 1 ]]; then
  # Needs to be here to prevent volta install script from re-adding it
  export VOLTA_HOME="$HOME/.volta"
  export PATH="$VOLTA_HOME/bin:$PATH"
fi
