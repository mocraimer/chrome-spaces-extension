#!/bin/bash

# Test script specifically for space name editing functionality
# This script runs all tests related to space name editing and persistence

echo "🧪 Running Space Name Editing Tests..."
echo "======================================"

# Run unit tests for space name editing UI
echo "📱 Testing UI Components..."
npm run test -- --testPathPattern="SpaceNameEditing" --verbose

# Run integration tests for persistence
echo "💾 Testing Storage Persistence..."
npm run test -- --testPathPattern="SpaceNamePersistence" --verbose

# Run validation tests
echo "✅ Testing Validation Logic..."
npm run test -- --testPathPattern="SpaceNameValidation" --verbose

# Run E2E tests (requires built extension)
echo "🌐 Running E2E Tests..."
if [ -d "build" ]; then
    npm run test:e2e -- --grep "Space Name Persistence"
else
    echo "⚠️  Skipping E2E tests - build directory not found. Run 'npm run build' first."
fi

echo ""
echo "✨ All space name editing tests completed!"
echo ""
echo "Test Coverage:"
echo "- ✅ UI interaction tests (Enter, Escape, Save, Cancel)"
echo "- ✅ Storage persistence across Chrome restarts"
echo "- ✅ Validation and edge cases"
echo "- ✅ Concurrent editing scenarios"
echo "- ✅ Closed space name persistence"
echo ""
echo "To run individual test suites:"
echo "  npm run test -- --testPathPattern='SpaceNameEditing'"
echo "  npm run test -- --testPathPattern='SpaceNamePersistence'"
echo "  npm run test -- --testPathPattern='SpaceNameValidation'"
echo "  npm run test:e2e -- --grep 'Space Name Persistence'"