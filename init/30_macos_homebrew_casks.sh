# macOS-only stuff. Abort if not macOS.
is_macos || return 1
# Disable for now.
return 1

# Exit if Homebrew is not installed.
[[ ! "$(type -P brew)" ]] && e_error "Brew casks need Homebrew to install." && return 1


# Hack to show the first-run brew-cask password prompt immediately.
brew cask info this-is-somewhat-annoying 2>/dev/null
brew tap homebrew/cask-versions

# Homebrew casks
casks=(
  adoptopenjdk8
  # Applications
  #  1password
  #  alfred
  #  bartender
  #  docker
  #  kap
  #  google-chrome
  #  hyper
  #  visual-studio-code
  #  firefox
  #  insomnia
  #  iterm2
  #  numi
  #  omnifocus
  #  macvim
  #  slack
  #  spotify
  #  pastebot
  #  the-unarchiver
  #  simplenote
  #  whatsapp
  #  fantastical
  #  rocket
  #  discord
)

# Install Homebrew casks.
casks=($(setdiff "${casks[*]}" "$(brew list --casks 2>/dev/null)"))
if (( ${#casks[@]} > 0 )); then
  e_header "Installing Homebrew casks: ${casks[*]}"
  for cask in "${casks[@]}"; do
    brew install --cask $cask
  done
  brew cask cleanup
fi
