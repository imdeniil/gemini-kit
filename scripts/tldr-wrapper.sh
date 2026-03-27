#!/bin/bash
# tldr-wrapper.sh
# Ensures all linters are in PATH before running tldr

# Add local bin, composer bin, and ruby bin to PATH
RUBY_BIN=$(ruby -e 'print Gem.user_dir' 2>/dev/null)/bin
export PATH="$PATH:$HOME/.local/bin:$HOME/.config/composer/vendor/bin:$RUBY_BIN"

# Execute tldr with all passed arguments
tldr "$@"
