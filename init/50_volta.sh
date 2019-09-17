curl https://get.volta.sh | bash

tools=(
  node
  yarn
  serve
)

for tool in "${tools[@]}"; do
  ~/.volta/volta install $tool
done
