curl https://get.volta.sh | bash

tools=(
  node@16
  yarn
  serve
  now
  fkill-cli
  dockly
  git-checkout-interactive
  jira-cli
  @oyvinmar-forks/dev-cli
)

# For some reason we can only pipe the list when the --verbose flag is set
installed_tools="$(volta list --format=plain --verbose | awk '/ .*@.* / {print $2}' | sed 's/@.*//g')"

tools=($(setdiff "${tools[*]}" "${installed_tools[*]}"))
for tool in "${tools[@]}"; do
  volta install $tool
done
