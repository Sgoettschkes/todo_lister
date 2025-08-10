#!/bin/bash

# Simple K6 test runner for TodoLister
# Usage: ./run.sh

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the script directory and run the test
cd "$SCRIPT_DIR"
k6 run test.js