# Dotfiles

My OSX / Ubuntu dotfiles.

Shamelessly copied from https://github.com/cowboy/dotfiles

Some notable tweaks:
- Use [zsh](https://www.zsh.org/) shell.
- [Pure](https://github.com/sindresorhus/pure) prompt
- [Volta](https://docs.volta.sh/) to manage JavaScript command-line tools (i.e. NodeJS, yarn, etc).



## About this project

I finally decided that I wanted to be able to execute a single command to "bootstrap" a new system to pull down all of my dotfiles and configs, as well as install all the tools I commonly use. In addition, I wanted to be able to re-execute that command at any time to synchronize anything that might have changed. Finally, I wanted to make it easy to re-integrate changes back in, so that other machines could be updated.

That command is [dotfiles][dotfiles], and this is my "dotfiles" Git repo.

[dotfiles]: bin/dotfiles

## How the "dotfiles" command works

When [dotfiles][dotfiles] is run for the first time, it does a few things:

1. In Ubuntu, Git is installed if necessary via APT (it's already there in OSX).
1. This repo is cloned into your user directory, under `~/.dotfiles`.
1. Files in `/copy` are copied into `~/`. ([read more](#the-copy-step))
1. Files in `/link` are symlinked into `~/`. ([read more](#the-link-step))
1. Files in `/config` are symlinked into `~/.config`. ([read more](#the-config-step))
1. You are prompted to choose scripts in `/init` to be executed. The installer attempts to only select relevant scripts, based on the detected OS and the script filename.
1. Your chosen init scripts are executed (in alphanumeric order, hence the funky names). ([read more](#the-init-step))

On subsequent runs, step 1 is skipped, step 2 just updates the already-existing repo, and step 5 remembers what you selected the last time. The other steps are the same.

### Other subdirectories

- The `/backups` directory gets created when necessary. Any files in `~/` that would have been overwritten by files in `/copy` or `/link` get backed up there.
- The `/bin` directory contains executable shell scripts (including the [dotfiles][dotfiles] script) and symlinks to executable shell scripts. This directory is added to the path.
- The `/caches` directory contains cached files, used by some scripts or functions.
- The `/conf` directory just exists. If a config file doesn't **need** to go in `~/`, reference it from the `/conf` directory.
- The `/source` directory contains files that are sourced whenever a new shell is opened (in alphanumeric order, hence the funky names).
- The `/test` directory contains unit tests for especially complicated bash functions.
- The `/vendor` directory contains third-party libraries.

### The "copy" step

Any file in the `/copy` subdirectory will be copied into `~/`. Any file that _needs_ to be modified with personal information (like [copy/.gitconfig](copy/.gitconfig) which contains an email address and private key) should be _copied_ into `~/`. Because the file you'll be editing is no longer in `~/.dotfiles`, it's less likely to be accidentally committed into your public dotfiles repo.

### The "link" step

Any file in the `/link` subdirectory gets symlinked into `~/` with `ln -s`. Edit one or the other, and you change the file in both places. Don't link files containing sensitive data, or you might accidentally commit that data! If you're linking a directory that might contain sensitive data (like `~/.ssh`) add the sensitive files to your [.gitignore](.gitignore) file!

### The "config" step

Same as [the link step](#the-link-step) except that all files get symlinked into `~/.config`.

### The "init" step

Scripts in the `/init` subdirectory will be executed. A whole bunch of things will be installed, but _only_ if they aren't already.

#### OS X

- Minor XCode init via the [init/10_osx_xcode.sh](init/10_osx_xcode.sh) script
- Homebrew via the [init/20_osx_homebrew.sh](init/20_osx_homebrew.sh) script
- Homebrew recipes via the [init/30_osx_homebrew_recipes.sh](init/30_osx_homebrew_recipes.sh) script
- Homebrew casks via the [init/30_osx_homebrew_casks.sh](init/30_osx_homebrew_casks.sh) script

#### Ubuntu

- APT packages and git-extras via the [init/20_ubuntu_apt.sh](init/20_ubuntu_apt.sh) script

#### Both

- Set zsh as the default login shell via the [init/40_zsh.sh](init/40_zsh.sh) scrip
- [Volta](https://docs.volta.sh/) with Node.js, npm and yarn via the [init/50_node.sh](init/50_volta.sh) script

## Hacking my dotfiles

Because the [dotfiles][dotfiles] script is completely self-contained, you should be able to delete everything else from your dotfiles repo fork, and it will still work. The only thing it really cares about are the `/copy`, `/link` and `/init` subdirectories, which will be ignored if they are empty or don't exist.

If you modify things and notice a bug or an improvement, [file an issue](https://github.com/oyvinmar/dotfiles/issues) or [a pull request](https://github.com/oyvinmar/dotfiles/pulls) and let me know.

Also, before installing, be sure to [read my gently-worded note](#heed-this-critically-important-warning-before-you-install).

## Installation

### OS X Notes

You need to have [XCode](https://developer.apple.com/downloads/index.action?=xcode) or, at the very minimum, the [XCode Command Line Tools](https://developer.apple.com/downloads/index.action?=command%20line%20tools), which are available as a much smaller download.

The easiest way to install the XCode Command Line Tools in OSX 10.9+ is to open up a terminal, type `xcode-select --install` and [follow the prompts](http://osxdaily.com/2014/02/12/install-command-line-tools-mac-os-x/).

_Tested in OSX 10.10_

### Ubuntu Notes

You might want to set up your ubuntu server [like I do it](https://github.com/cowboy/dotfiles/wiki/ubuntu-setup), but then again, you might not.

Either way, you should at least update/upgrade APT with `sudo apt-get -qq update && sudo apt-get -qq dist-upgrade` first.

_Tested in Ubuntu 14.04 LTS_

### Heed this critically important warning before you install

**If you're not me, please _do not_ install dotfiles directly from this repo!**

Why? Because I often completely break this repo while updating. Which means that if I do that and you run the `dotfiles` command, your home directory will burst into flames, and you'll have to go buy a new computer. No, not really, but it will be very messy.

### Actual installation

1. [Read my gently-worded note](#heed-this-critically-important-warning-before-you-install)
1. Fork this repo
1. Open a terminal/shell and do this (change `oyvinmar` and `master` as appropriate):

#### Ubuntu

```sh
export DOTFILES_GH_USER=oyvinmar
export DOTFILES_GH_BRANCH=master
bash -c "$(wget -qO- https://raw.github.com/$DOTFILES_GH_USER/dotfiles/$DOTFILES_GH_BRANCH/bin/dotfiles)" && zsh
```

#### macOS

```sh
export DOTFILES_GH_USER=oyvinmar
export DOTFILES_GH_BRANCH=master
bash -c "$(curl -fsSL https://raw.github.com/$DOTFILES_GH_USER/dotfiles/$DOTFILES_GH_BRANCH/bin/dotfiles)" && zsh
```

Since you'll be using the [dotfiles][dotfiles] command on subsequent runs, you'll only have to set the `DOTFILES_GH_USER` variable for the initial install, but if you have a custom branch, you _will_ need to export `DOTFILES_GH_BRANCH` for subsequent runs.

There's a lot of stuff that requires admin access via `sudo`, so be warned that you might need to enter your password here or there.

### Actual installation (for me)

#### Ubuntu

```sh
bash -c "$(wget -qO- https://raw.github.com/oyvinmar/dotfiles/master/bin/dotfiles)" && zsh
```

#### macOS

```sh
bash -c "$(curl -fsSL https://raw.github.com/oyvinmar/dotfiles/master/bin/dotfiles)" && zsh
```

## Aliases and Functions

To keep things easy, the `~/.zshrc` file is very simple, and should never need to be modified. Instead, add your aliases, functions, settings, etc into one of the files in the `source` subdirectory, or add a new file. They're all automatically sourced when a new shell is opened. Take a look, I have [a lot of aliases and functions](source).

## Scripts

In addition to the aforementioned [dotfiles][dotfiles] script, there are a few other [bin scripts](bin).

- [dotfiles][dotfiles] - (re)initialize dotfiles. It might ask for your password (for `sudo`).
- [src](link/.zshrc#L78-84) - (re)source all files in `/source` directory
- Look through the [bin](bin) subdirectory for a few more.

## License

Copyright (c) 2019 Øyvind Marthinsen
Licensed under the MIT license.
