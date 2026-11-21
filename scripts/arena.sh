#!/usr/bin/env bash
# Run the arena on 4 seeds in parallel and total the results.
#   scripts/arena.sh [PAIRS] ; env W='{"weight":value}' LEVEL=normal|hard OPP=baseline|normal
cd "$(dirname "$0")/.."
PAIRS=${1:-8}
tmp=$(mktemp -d)
for s in 1 2 3 4; do
  SEED=$s PAIRS=$PAIRS npx vitest run --config scripts/vitest.config.ts scripts/arena.run.ts > "$tmp/$s.txt" 2>&1 &
done
wait
grep -h ARENA "$tmp"/*.txt
grep -h ARENA "$tmp"/*.txt | python3 -c "
import sys,re
w=d=l=0
for line in sys.stdin:
    m=re.search(r'W (\d+) D (\d+) L (\d+)',line); w+=int(m[1]); d+=int(m[2]); l+=int(m[3])
n=w+d+l; print(f'TOTAL W {w} D {d} L {l} score {100*(w+d/2)/n:.0f}% over {n} games')"
