#!/bin/bash

# Edge Functions Route Test Script
# Tests that all 6 functions are properly routed through the main router

set -e

SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}"
FUNCTIONS_BASE="$SUPABASE_URL/functions/v1"

echo "🧪 Testing Edge Functions Routing"
echo "=================================="
echo "Base URL: $FUNCTIONS_BASE"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test a route
test_route() {
  local route=$1
  local name=$2

  echo -n "Testing $name... "

  # Test OPTIONS (CORS preflight)
  http_code=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$FUNCTIONS_BASE/$route")

  if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ CORS OK${NC} (OPTIONS $http_code)"
  else
    echo -e "${RED}✗ CORS FAILED${NC} (OPTIONS $http_code)"
    return 1
  fi
}

# Test health endpoint
echo "Testing health endpoint..."
response=$(curl -s "$FUNCTIONS_BASE/" || echo '{"status":"error"}')
status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "error")

if [ "$status" = "healthy" ]; then
  echo -e "${GREEN}✓ Edge Runtime is healthy${NC}"
  echo "Available routes:"
  echo "$response" | grep -o '"routes":\[[^]]*\]' | sed 's/"routes"://;s/\[//;s/\]//;s/,/\n/g;s/"//g' | sed 's/^/  - /'
  echo ""
else
  echo -e "${RED}✗ Edge Runtime health check failed${NC}"
  echo "Response: $response"
  exit 1
fi

# Test all routes
echo "Testing individual routes:"
echo ""

test_route "prepare-next-meeting" "prepare-next-meeting"
test_route "transcribe-with-gemini" "transcribe-with-gemini"
test_route "start-transcription" "start-transcription"
test_route "enhance-local-transcription" "enhance-local-transcription"
test_route "upload-async-file" "upload-async-file"
test_route "cleanup-expired-audio" "cleanup-expired-audio"

echo ""
echo -e "${GREEN}=================================="
echo "✓ All routes are accessible!"
echo "==================================${NC}"
echo ""
echo "Note: These tests only verify routing (OPTIONS request)."
echo "Actual function calls require authentication and proper payloads."
