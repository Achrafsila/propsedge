#!/bin/bash
# Script pour afficher la structure des branches QUANTFLOW V1

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌳 QUANTFLOW V1 - STRUCTURE DES BRANCHES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "🎯 BRANCHES PRINCIPALES"
echo "─────────────────────────────────"
git branch -v | grep -E '^\*?\s+(main|develop|staging)'
echo ""

echo "📦 BRANCHES DE PHASES"
echo "─────────────────────────────────"
git branch -v | grep 'feature/phase'
echo ""

echo "🛠️ BRANCHES DE SKILLS"
echo "─────────────────────────────────"
git branch -v | grep 'skill/'
echo ""

echo "📚 BRANCHES DE DOCUMENTATION"
echo "─────────────────────────────────"
git branch -v | grep 'docs/'
echo ""

echo "🐛 BRANCHES DE BUGFIX"
echo "─────────────────────────────────"
git branch -v | grep 'fix/'
echo ""

echo "🔬 BRANCHES EXPÉRIMENTALES"
echo "─────────────────────────────────"
git branch -v | grep 'experiment/'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 TOTAL: $(git branch | wc -l) branches"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
