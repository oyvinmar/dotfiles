# Shortcuts and config for Node.js and related tools

export NODE_ENV=development

alias y='yarn'
alias yb='yarn build'
alias yd='yarn dev'
alias yui='yarn upgrade-interactive --latest'
alias dev='dev-cli dev'

function nr () {
  npm run $1 -- $@[2,-1]
}
