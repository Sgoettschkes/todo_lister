#!/bin/bash

# K6 test runner for TodoLister with Phoenix app management
# Usage: ./run.sh

set -e

# Get the directory where this script is located (now in project root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    printf "${2}${1}${NC}\n"
}

# Variable to track Phoenix PID
PHOENIX_PID=""
# Track if we started Phoenix
WE_STARTED_PHOENIX=false

# Function to check if Phoenix is already running
check_phoenix_running() {
    if curl -s http://localhost:4000 > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Function to start Phoenix server
start_phoenix() {
    # Check if Phoenix is already running
    if check_phoenix_running; then
        print_color "✅ Phoenix server is already running on port 4000" "$GREEN"
        return 0
    fi
    
    print_color "🚀 Starting Phoenix server..." "$GREEN"
    cd "$PROJECT_DIR"
    
    # Start Phoenix in background and capture PID, redirecting output to /dev/null
    mix phx.server > /dev/null 2>&1 &
    PHOENIX_PID=$!
    WE_STARTED_PHOENIX=true
    
    print_color "Phoenix started with PID: $PHOENIX_PID" "$YELLOW"
    
    # Wait for Phoenix to be ready
    print_color "⏳ Waiting for Phoenix server to be ready..." "$YELLOW"
    for i in {1..30}; do
        if curl -s http://localhost:4000 > /dev/null 2>&1; then
            print_color "✅ Phoenix server is ready!" "$GREEN"
            return 0
        fi
        sleep 1
        printf "."
    done
    
    print_color "❌ Phoenix server failed to start within 30 seconds" "$RED"
    return 1
}

# Function to stop Phoenix server
stop_phoenix() {
    if [ -n "$PHOENIX_PID" ]; then
        print_color "🛑 Stopping Phoenix server (PID: $PHOENIX_PID)..." "$YELLOW"
        kill "$PHOENIX_PID" 2>/dev/null || true
        
        # Wait for process to stop gracefully
        for i in {1..5}; do
            if ! kill -0 "$PHOENIX_PID" 2>/dev/null; then
                print_color "✅ Phoenix server stopped gracefully" "$GREEN"
                return 0
            fi
            sleep 1
        done
        
        # Force kill if still running
        print_color "⚡ Force killing Phoenix server..." "$YELLOW"
        kill -9 "$PHOENIX_PID" 2>/dev/null || true
    fi
}

# Function to cleanup on exit
cleanup() {
    # Only stop Phoenix if we started it
    if [ "$WE_STARTED_PHOENIX" = true ]; then
        print_color "\n🧹 Cleaning up..." "$YELLOW"
        stop_phoenix
    fi
}

# Set trap to cleanup on script exit (success, failure, or interrupt)
trap cleanup EXIT INT TERM

# Main execution
main() {
    print_color "═══════════════════════════════════════" "$GREEN"
    print_color "TodoLister K6 Load Test Runner" "$GREEN"
    print_color "═══════════════════════════════════════" "$GREEN"
    
    # Start Phoenix server
    if ! start_phoenix; then
        print_color "❌ Failed to start Phoenix server" "$RED"
        exit 1
    fi
    
    # Change to k6 directory and run the test
    print_color "\n🧪 Running k6 load test..." "$GREEN"
    cd "$PROJECT_DIR/k6"
    
    # Run k6 test and capture exit code
    if k6 run test.js; then
        print_color "✅ Load test completed successfully!" "$GREEN"
        TEST_EXIT_CODE=0
    else
        print_color "❌ Load test failed!" "$RED"
        TEST_EXIT_CODE=1
    fi
    
    print_color "═══════════════════════════════════════" "$GREEN"
    print_color "Test run complete" "$GREEN"
    print_color "═══════════════════════════════════════" "$GREEN"
    
    # Exit with the same code as the k6 test
    exit $TEST_EXIT_CODE
}

# Run main function
main