[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/alchemist199/makefun-token-radar-01-r2/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/alchemist199/makefun-token-radar-01-r2/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Token Radar — round 2

203 pre-token protocols ranked by one fitted size curve: `log(mcap) = a + b · log(TVL)`, fitted by OLS on the 93 restricted token comps at run time from the sealed snapshot. No growth, age or chains term — all three were tested as extra regressors and dropped on measured blind error (growth's fitted sign flips by split; age makes the time-split error ×6.0). Blind error about ×3.50 (5-fold) and ×2.07 (time-split), against ×5.25 for round 1's category-median model on the same 5-fold.

Every row carries a 7-step farm plan costed per chain, with a net line that prices the whole plan against the model's implied value, and a verdict (Farm / Watch / Small) from a stated rule printed on the page.

Run it:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

Node 22, standard library only. The build is deterministic: two runs write byte-identical output.
