if [[ ! "$(type -P teamocil)" ]]; then
  echo "Installing teamocil"

  if is_macOS; then
    gem install teamocil
  else
    sudo gem install teamocil
  fi
fi
