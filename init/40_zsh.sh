# set zsh as default shell
if [[ "$0" != "zsh" ]]; then
  chsh -s $(which zsh)
fi