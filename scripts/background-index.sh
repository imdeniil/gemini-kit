#!/bin/bash
# background-index.sh
# A completely self-contained script for background indexing and notification

PROJECT_DIR="$1"
EXTENSION_DIR="/home/keemor/.gemini/extensions/gemini-kit"
LOG_FILE="$PROJECT_DIR/.gemini-kit/logs/indexing.log"
PAYLOAD="$2"

cd "$PROJECT_DIR" || exit 1

# Ensure PATH is correct
RUBY_BIN=$(ruby -e 'print Gem.user_dir' 2>/dev/null)/bin
export PATH="$PATH:$HOME/.local/bin:$HOME/.config/composer/vendor/bin:$RUBY_BIN"

{
  echo "[$(date -Iseconds)] Starting background indexing..."
  tldr warm .
  echo "[$(date -Iseconds)] Indexing done. Sending notification..."
  node "$EXTENSION_DIR/hooks/telegram-notify.js" "$PAYLOAD"
  echo "[$(date -Iseconds)] Notification sequence finished."
} >> "$LOG_FILE" 2>&1
