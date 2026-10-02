#!/bin/bash
# 全量测试:所有 pN 套件逐个跑,汇总红绿
cd "$(dirname "$0")/.." || exit 1
FAIL=0
for t in tests/*.test.mjs; do
  if [[ "$t" == *"p1-smoke"* ]]; then
    node "$t" > /tmp/out.txt 2>&1
  else
    node --import ./tests/helpers/register.mjs "$t" > /tmp/out.txt 2>&1
  fi
  if [[ $? -eq 0 ]]; then
    echo "PASS $t"
  else
    echo "FAIL $t"
    tail -5 /tmp/out.txt
    FAIL=1
  fi
done
exit $FAIL
