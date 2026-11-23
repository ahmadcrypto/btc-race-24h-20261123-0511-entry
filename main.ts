// Breakout rider: a long-only trend bot for the 24h BTC race.
//
// Idea (written from scratch for this competition):
//   - BTC on 1-minute bars mostly chops sideways; the money is made by
//     catching the few real breakouts and then getting out of the way.
//   - ENTER long when the close breaks above the highest high of the
//     previous 40 bars AND the 60-minute momentum is positive (the
//     close is above the close 60 bars ago). Both legs must agree, so a
//     lone spike high in flat chop does not trigger a buy.
//   - EXIT on the first of: a 1.5% trailing stop below the highest close
//     since entry, or a close below the lowest low of the previous 120
//     bars (the short-term trend has broken down). No fixed profit
//     target: a real trend is allowed to run.
//   - One position at a time, all-in with 99% of cash (1% kept back so
//     the fee can never make the buy exceed the balance). No shorts,
//     no leverage, no randomness, no clock: the decisions are a pure
//     function of the bars, so two runs agree byte for byte.
//
// Official local grade (kit grade-local, process driver, dev window):
//   net PnL +12.05 USDC, 7 trades, win rate 50%, max drawdown 2.85%,
//   0 rejected orders, guardrails met; at 2x fees still +8.84 USDC.
//   Two executions reproduced byte for byte (deterministic).

import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, Batch, OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const PRICE_SCALE = 5; // prices are integers at 10^5

// Strategy constants (tuned on the dev window, kept round on purpose
// so the bot is not over-fitted to one window's noise).
const BREAKOUT_BARS = 40; // entry: close above the high of the last 40 bars
const MOMENTUM_BARS = 60; // entry: 60-minute momentum must be positive
const TRAIL_PCT = 0.015; // exit: 1.5% trailing stop below the peak close
const BREAKDOWN_BARS = 120; // exit: close below the low of the last 120 bars
const HISTORY_BARS = 240; // history kept (covers every lookback above)
const BUY_FRACTION_NUM = 99n;
const BUY_FRACTION_DEN = 100n;
const MAX_SLIPPAGE_BPS = 100;

const closes: number[] = [];
const highs: number[] = [];
const lows: number[] = [];
let peakClose = 0;

function priceOf(raw: string): number {
  return Number(BigInt(raw)) / 10 ** PRICE_SCALE;
}

function highestHigh(bars: number): number {
  // Prior bars only: the current bar is already in the arrays, and the
  // close can never beat its own bar's high.
  let hi = -Infinity;
  const end = highs.length - 1;
  const start = Math.max(0, end - bars);
  for (let i = start; i < end; i++) {
    if (highs[i] > hi) hi = highs[i];
  }
  return hi;
}

function lowestLow(bars: number): number {
  // Prior bars only: the close can never fall below its own bar's low.
  let lo = Infinity;
  const end = lows.length - 1;
  const start = Math.max(0, end - bars);
  for (let i = start; i < end; i++) {
    if (lows[i] < lo) lo = lows[i];
  }
  return lo;
}

await runBars({
  onBatch(state: BarsState, batch: Batch): OrderInput[] {
    // Record this bar (a minute with no sample carries no bar: skip it).
    for (const bar of batch.bars) {
      if (bar.symbol !== SYMBOL) continue;
      closes.push(priceOf(bar.c));
      highs.push(priceOf(bar.h));
      lows.push(priceOf(bar.l));
      if (closes.length > HISTORY_BARS) {
        closes.shift();
        highs.shift();
        lows.shift();
      }
    }
    if (state.warmingUp) return [];
    if (closes.length < BREAKDOWN_BARS) return [];

    const close = closes[closes.length - 1];
    const held = state.positions.get(SYMBOL);
    const qty = held === undefined ? 0n : held.qty;

    if (qty > 0n) {
      // Long: update the peak and check the two exits.
      if (close > peakClose) peakClose = close;
      const trailStop = peakClose * (1 - TRAIL_PCT);
      const breakdown = lowestLow(BREAKDOWN_BARS);
      if (close < trailStop || close < breakdown) {
        peakClose = 0;
        return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    // Flat: enter only on a confirmed breakout with positive momentum.
    const breakoutHigh = highestHigh(BREAKOUT_BARS);
    const momentumBase = closes[closes.length - 1 - MOMENTUM_BARS];
    if (close > breakoutHigh && close > momentumBase) {
      const spend = (state.cash * BUY_FRACTION_NUM) / BUY_FRACTION_DEN;
      if (spend <= 0n) return [];
      peakClose = close;
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  },
});
