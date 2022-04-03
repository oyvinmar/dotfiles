if [[ ! "$(type -P rustup)" ]]; then
  echo "Installing rust"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs > install-rust.sh
  chmod +x install-rust.sh
  ./install-rust.sh --no-modify-path --profile default -y
fi

crates=(
  difftastic
)

for crate in "${crates[@]}"; do
  cargo install $crate
done

