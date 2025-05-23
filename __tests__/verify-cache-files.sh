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
  echo "Must specify path argument"
  exit 1
fi

# Sanity check GITHUB_RUN_ID defined
if [ -z "$GITHUB_RUN_ID" ]; then
  echo "GITHUB_RUN_ID not defined"
  exit 1
fi

# Verify file exists
file="$path/test-file.txt"
echo "Checking for $file"
if [ -n "$abs_path" ]; then
  echo "Full path: $abs_path"
fi
if [ ! -e $file ]; then
  echo "File does not exist"
  exit 1
fi

# Verify file content
content="$(cat $file)"
echo "File content:\n$content"
if [ -z "$(echo $content | grep --fixed-strings "$prefix $GITHUB_RUN_ID")" ]; then
  echo "Unexpected file content"
  exit 1
fi
