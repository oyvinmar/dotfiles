# Shortcuts and config for Node.js and related tools

export NODE_ENV=development

alias y='yarn'
alias yb='yarn build'
alias yd='yarn dev'
alias yui='yarn upgrade-interactive --latest'
alias dev='nel dev'
alias build='nel build'
alias watch='nel watch'
alias deploy='nel deploy'
alias merge='nel merge'
alias cb='nel vc co'
alias cpr='nel vc cop'
alias vc='nel vc'
alias nel-dev='/Users/oyvind/develop/personal/nel/dist/index.js'

function nr () {
  npm run $1 -- $@[2,-1]
}
