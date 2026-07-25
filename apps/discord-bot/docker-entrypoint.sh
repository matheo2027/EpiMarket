#!/bin/sh
set -e

npm install
npm run "${1:-dev}"
