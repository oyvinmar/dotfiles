export PATH="$DOTFILES/bin:$HOME/.cargo/bin:$HOME/.bin:$PATH"

if is_macos_arm; then
  export PATH="/opt/homebrew/bin:$PATH"
fi
