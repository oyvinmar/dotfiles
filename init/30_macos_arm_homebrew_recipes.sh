

# macOS arm only stuff. Abort if not.
is_macos_arm || return 1

# Install Homebrew recipes.
function brew_install_recipes() {
  recipes=($(setdiff "${recipes[*]}" "$(brew list --formula)"))
  if (( ${#recipes[@]} > 0 )); then
    e_header "Installing Homebrew recipes: ${recipes[*]}"
    for recipe in "${recipes[@]}"; do
      brew install $recipe
    done
  fi
}

function brew_tap_kegs() {
  kegs=($(setdiff "${kegs[*]}" "$(brew tap)"))
  if (( ${#kegs[@]} > 0 )); then
    e_header "Tapping Homebrew kegs: ${kegs[*]}"
    for keg in "${kegs[@]}"; do
      brew tap $keg
    done
  fi
}


# Exit if Homebrew is not installed.
[[ ! "$(type -P brew)" ]] && e_error "Brew recipes need Homebrew to install." && return 1

# Ensure third party kegs are tapped.
kegs=(
  MisterTea/et
  mongodb/brew
)

brew_tap_kegs
# Homebrew recipes
recipes=(
  zsh
  httpie
  git
  nmap
  sl
  thefuck
  tmux
  wget
  htop
  ruby
  neovim
  tree
  bat
  et
  mongodb-community
  redis
  gh
  git-delta
  exa
)

if [[ ! "$(type -P java)" ]]; then
  hdiutil mount -mountpoint /Volumes/zulu https://cdn.azul.com/zulu/bin/zulu11.43.1021-ca-jdk11.0.9.1-macosx_aarch64.dmg
  sudo installer -pkg "/Volumes/zulu/*.pkg" -target /
  hdiutil unmount /Volumes/zulu

  arch -arm64 brew install --build-from-source rlwrap
  arch -arm64 brew install clojure/tools/clojure
  ln -s /Library/Java/JavaVirtualMachines/zulu-11.jdk/Contents/Home /opt/homebrew/opt/openjdk
  arch -arm64 brew install maven --ignore-dependencies
  arch -arm64 brew install --build-from-source leiningen --ignore-dependencies
fi

brew_install_recipes

# Misc cleanup!

# This is where brew stores its binary symlinks
local binroot="$(brew --config | awk '/HOMEBREW_PREFIX/ {print $2}')"/bin

# htop
if [[ "$(type -P $binroot/htop)" ]] && [[ "$(stat -L -f "%Su:%Sg" "$binroot/htop")" != "root:wheel" || ! "$(($(stat -L -f "%DMp" "$binroot/htop") & 4))" ]]; then
  e_header "Updating htop permissions"
  sudo chown root:wheel "$binroot/htop"
  sudo chmod u+s "$binroot/htop"
fi
