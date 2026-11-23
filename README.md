# BTC Race 24h — Breakout Rider

[![make.fun](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/ahmadcrypto/btc-race-24h-20261123-0511-entry/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/ahmadcrypto/btc-race-24h-20261123-0511-entry/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511)

A long-only cbBTC/USDC trading bot for the make.fun bounty
[Race a BTC trading bot live for 24 hours](https://make.fun/bounty/btc-race-24h-20261123-0511).
It trades 1-minute bars with $1,000 of paper money, one position at a time,
no shorts, no leverage.

## Strategy

Breakout rider, written from scratch:

- Enter long when the close breaks the high of the last 40 bars **and**
  60-minute momentum is positive (both must agree, so a lone spike in
  chop does not trigger a buy).
- Exit on a 1.5% trailing stop below the peak close since entry, or when
  the close breaks the low of the last 120 bars. No profit target — a real
  trend is left to run.
- All-in 99% of cash, one open position, deterministic (pure function of
  bars, no clock, no randomness).

## Local dev-window grade

Run from the kit directory:

```sh
node cli/makefun.mjs grade-local --kit . --bot <this repo> --driver process --worktree
```

- Net PnL on the frozen 24h dev window: **+12.052605 USDC** (+1.21%),
  above the dev gate (must be > 0). At 2x fees still +8.84 USDC.
- 7 trades (4 round trips), win rate 50%, max drawdown 2.85%,
  exposure 65%, fees 3.21 USDC, 0 rejected, guardrails met.
- L1 regrade reproduced byte for byte.

## Run

`main.ts` speaks `agent-fun/bars-replay/v1` (newline-delimited JSON on
stdin/stdout) on Node 22, standard library only. `vendor/makefun-bars.ts`
is the kit SDK shim, copied byte-for-byte under `vendor/`.

## License

MIT
