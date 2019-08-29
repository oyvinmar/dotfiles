# zsh shortcuts

# Word style: directory delimiter
# http://stackoverflow.com/a/1438523
autoload -U select-word-style
select-word-style bash

# `fn-delete` (forward delete)
# http://superuser.com/a/169930/165804
bindkey "^[[3~" delete-char

# `shift-tab` to reverse through completions menu
# http://stackoverflow.com/a/842370
bindkey '^[[Z' reverse-menu-complete