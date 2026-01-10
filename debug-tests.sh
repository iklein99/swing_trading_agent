#!/bin/bash

# Debug all database tests
echo "🔍 Debugging all database tests..."
cd backend && node --inspect-brk ./node_modules/.bin/jest --testPathPattern=database --runInBand --no-cache

# Alternative: Debug specific test file
# cd backend && node --inspect-brk ./node_modules/.bin/jest src/database/__tests__/trade-repository.test.ts --runInBand --no-cache

# Alternative: Debug specific test by name
# cd backend && node --inspect-brk ./node_modules/.bin/jest --testNamePattern="should create a new trade" --testPathPattern=database --runInBand --no-cache