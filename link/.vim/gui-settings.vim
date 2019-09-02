set noshowmode " Get rid of extra --INSERT-- rendered below.

if has("gui_running") " all this for gui use
  " ugly MacVim Cruft
  set guioptions-=r "remove scrollbars
  set guioptions-=R "remove scrollbars
  set guioptions-=l "remove scrollbars
  set guioptions-=L "remove scrollbars
  set guioptions-=T " Remove toolbars

  set fileformats=unix

  "========== Mac OS X ==================================
  " Pro Tips:
  " Make sure to turn off anti-aliasing in general preferences panel.
  if has("gui_macvim") || has("gui_vimr")
    " Set to empty string - no ugly NonText ~ etc.
    set fillchars=vert:\ ,diff:\

    " Don't remove tabs on MacVim because VimGUITabs plugin makes them get out
    " of the way when we want them to get out of the way (in full screen mode).
    " set guioptions-=e
    " like A CSS Reset:
    let macvim_skip_colorscheme = 1
    set transparency=0
    set fuoptions=maxvert,maxhorz
    " The following is how you set a special linespace *per* font:
    set guifont=PragmataPro:h12,Essential\ PragmataPro:h12,iosevka:h12
    " For iosevka to render perfectly in macvim, linespace -1
    set nolazyredraw
    " Change to `1` if your font is patched with webdev icons.
    let g:webdevicons_enable = 0
  endif
  " Set your own custom symbols in your ~/.vim/vimrc.custom.after
  " Symbols to use: Some look better without italics! Check compatibility with
  " your font.
  " Some fonts require setting ambiwidth=double
  " ☻  ⬢  ⬡ ⍟⨷  ⮾  ⮿  ⏣  ⬣  ⌾ ★  ☆ ✩ ✪  ⭑⭑⭑ ☒  ☑  ⮽  ✖✖ ✖✖✖ ✖    ⛆
  " ⛆ ☁ ⛈ ⛆
  let g:vimBoxLinterErrorSymbol="⮿"
  let g:vimBoxLinterWarningSymbol="⮿"
  let g:vimBoxLinterOkSymbol="☻"
else
  let g:vimBoxLinterErrorSymbol="⮿"
  let g:vimBoxLinterWarningSymbol="⮿"
  let g:vimBoxLinterOkSymbol="☻"
endif

" Make it so the ugly "NonText" characters are hidden at the end of a file
" (the ~)
augroup vimrc
  autocmd!
  autocmd ColorScheme * highlight NonText ctermfg=bg guifg=bg
augroup END

syntax enable

set background=dark
colorscheme one

" colorscheme snazzy
" let g:SnazzyTransparent = 1

" Transparent backgrounds
hi clear SignColumn
hi SignColumn ctermbg=NONE guibg=NONE
hi NonText guibg=NONE ctermbg=NONE guifg=NONE ctermfg=NONE
hi Normal guibg=NONE ctermbg=NONE
hi StatusLine guibg=NONE ctermbg=NONE
hi StatusLineNC ctermbg=NONE guibg=NONE
