#!/bin/bash
export SUPABASE_URL="${SUPABASE_URL:-your_supabase_url_here}"
export SUPABASE_KEY="${SUPABASE_KEY:-your_supabase_key_here}"
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-your_access_token_here}"
node "$(dirname "$0")/build/index.js" "$@"
