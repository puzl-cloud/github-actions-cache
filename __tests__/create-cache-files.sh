#!/bin/sh

# Validate args
prefix="$1"
if [ -z "$prefix" ]; then
  echo "Must supply prefix argument"
  exit 1
fi

path="$2"

# Expand ~ to $HOME in a POSIX-compliant way
case "$path" in
  ~/*) expanded_path="$HOME/${path#~/}" ;;
  ~) expanded_path="$HOME" ;;
  *) expanded_path="$path" ;;
esac

abs_path="$(realpath "$expanded_path")"

if [ -z "$path" ]; then
  echo "Must supply path argument"
  exit 1
fi

mkdir -p $path
echo "$prefix $GITHUB_RUN_ID" > $path/test-file.txt
if [ -n "$abs_path" ]; then
  echo "Full path: $abs_path"
fi
