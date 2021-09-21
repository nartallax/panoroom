#!/usr/bin/env bash

set -e
cd `dirname "$0"`
cd ..

./node_modules/.bin/imploder --tsconfig src/metaproject/tsconfig.json
node src/metaproject/js/bundle.js