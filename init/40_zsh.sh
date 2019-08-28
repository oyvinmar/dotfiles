# set zsh as default shell
if [[ "$SHELL" != *zsh ]]; then
  chsh -s $(which zsh)
fi
