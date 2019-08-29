
# Set the default shell to zsh if it isn't currently set to zsh
if [[ ! $(echo $SHELL) == $(which zsh) ]]; then
  chsh -s $(which zsh)
  # Update shell export for other scripts (i.e. volta)
  export SHELL=$(which zsh)
fi
