#!/bin/bash
# Wrapper script to vectorize Interlincx reports
# Usage: ./vectorize_interlincx.sh <runDate> <csv_path>

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <runDate> <csv_path>"
    echo "Example: $0 2025-11-10 /Users/ericroach/Downloads/Interlincx\ Mobile\ Only\ Report\ 11.10.25.csv"
    exit 1
fi

npx ts-node src/scripts/vector/embed_interlincx_keywords.ts --runDate="$1" --input="$2"


