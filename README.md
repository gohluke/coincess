# Coincess

A unified crypto trading super-app combining **perpetual futures** (Hyperliquid), **prediction markets** (Polymarket), and **automated strategies** — all in a single mobile-first PWA. Coincess earns builder/affiliate fees on every trade.

## Features

### Perpetual Futures Trading
- **279 perpetual markets** — crypto (BTC, ETH, SOL, memecoins, AI tokens) + HIP-3 markets (stocks, commodities, forex, indices)
- **Coin logos everywhere** — multi-tier logo resolver (local SVG/PNG for commodities, Clearbit CDN for stocks, CoinCap CDN for crypto, emoji fallback for forex/indices, letter avatar as last resort); shown in market selector header, dropdown rows, and search modal
- **URL-driven navigation** — clicking a coin in the market selector dropdown or search modal updates the URL to `/trade/COIN`, enabling shareable links and proper browser history
- **Search modal** — max leverage shown per market, category badges, real-time prices with flash animation
- **Real-time order book** and recent trades via WebSocket
- **Live market header** — Oracle, 24h Change, Volume, Open Interest, and Funding update in real-time via the `activeAssetCtx` WebSocket channel (not polling); `allMids` subscription drives live mark price ticks; REST fallback refreshes non-active markets every 30s
- **Interactive TradingView-style charts** with candlestick + volume, multiple timeframes, click-and-drag panning
- **Unified Account support** — enables trading HIP-3/RWA markets (stocks, commodities, forex); chain switch is best-effort so activation works regardless of wallet network; order form reads spot clearinghouse balance for accurate "Available" display; equity calculation correctly handles unified mode where spot USDC pool includes perp margin (avoids double-counting); funding payments fetched from both main and xyz dexes for accurate total PnL
- **Order placement** — market & limit orders, long/short, configurable leverage, TP/SL
- **Position management** — open positions, unrealized PnL, ROE; close at limit price, market close, reverse position; TP/SL prices shown inline on positions; AUTO badge scoped to user's own quant strategies (wallet-filtered); accurate round-trip duration on dashboard; click position to navigate to coin
- **Chart** — infinite scroll (lazy-loads older candles as you scroll left); custom HTML circle markers with "B"/"S" text centered inside (Hyperliquid style), positioned at exact fill price via timeToCoordinate/priceToCoordinate; **hoverable markers** — each B/S circle is individually hoverable (pointer cursor, tooltip on mouseenter/mouseleave) in addition to crosshair-triggered display; **deduplicated fills** — fills fetched from both main and xyz dexes are deduplicated by `tid` to prevent duplicate tooltip entries; hover tooltip shows trade details (e.g. "Close Long at 94.214", size, PnL); **position price lines** — horizontal lines drawn on the chart for active positions: Entry Price (gray dashed), Liquidation Price (red dashed), PNL at current mark (green/red dotted with dollar amount); **order price lines** — TP/SL trigger orders shown as green/red large-dashed lines, limit orders as solid lines, stop orders as red lines; all lines have axis labels on the price scale and auto-update on every position/order refresh; **stable view** — chart no longer auto-resets/snaps when data refreshes (fills polling excluded from chart data effect); manual "↺ Reset" button in the interval bar to fit-content on demand
- **TP/SL modal (Hyperliquid-style)** — clicking the pencil icon opens a centered modal with coin info, position size, entry/mark prices; **bidirectional inputs**: typing TP Price auto-calculates Gain in $, and typing Gain auto-calculates TP Price (same for SL Price ↔ Loss in $); pre-fills existing TP/SL values; TP/SL trigger orders are hidden from open orders and reflected directly on the position row
- **Order management** — compact single-row open orders table with inline edit for size/price, placed date, duration with seconds, and cancel all (TP/SL orders excluded); fetches orders from both main and xyz (HIP-3) dexes so stock/commodity/forex limit orders appear
- **Tabbed Order Book / Recent Trades** — order book and recent trades displayed as tabs side-by-side, only one visible at a time
- **Full-width positions panel** — positions/orders span the entire screen width below the chart (Based.app-style layout)
- **Share PNL** — generate and share position cards as PNG images with leverage, ROE, entry/current price, and rocket illustration; portrait (9:16) and square (1:1) aspect ratios; supports Download, Copy to clipboard, and native Share (mobile)

### Prediction Markets
- **Browse trending events** — politics, sports, crypto, pop culture, business, science, technology
- **Category filtering** — tabs including "Ending Soon" for markets about to close
- **Search** — find specific markets by keyword
- **Event detail pages** — full descriptions, all outcomes, volume/liquidity, time remaining
- **Bet slips** — Buy Yes/No with potential payout calculator
- **Market status** — visual indicators for closed/ended markets, urgency badges

### Automation Suite (`/automate`)

The automation page is a three-tab dashboard for managing all automated trading activity.

#### Tab 1: Server (24/7 Quant Engine)
Runs on a dedicated Contabo VPS via `pm2` — no browser needed. The quant engine ticks every 30 seconds, evaluating all active strategies and placing orders via the Hyperliquid API wallet.

- **Engine status bar** — live indicator (running / paused / error), last tick time, "Reset Engine" button when in error state (clears stale drawdown, resets peak equity to current NAV)
- **Key metrics row** — Total P&L (computed from actual closed trades + unrealized + funding), Funding Income, Unrealized P&L, NAV (live account value), Gross Exposure, Max Drawdown
- **Risk alert banner** — appears when engine hits an error (e.g. kill switch triggered); shows the exact error message with an inline "Reset" button to recover
- **Strategies table** — add/remove/toggle strategies (Funding Rate, Momentum, Grid, Mean Reversion, Market Maker); each card shows status, trade count, PnL, last execution time; funding rate cards expand to show per-position metrics
- **Open positions** — real-time positions from the Hyperliquid clearinghouse API (source of truth, not the engine's internal records); shows side, leverage, instrument, entry/mark price, size, 8-hour funding rate, unrealized PnL, ROE; positions tagged with strategy badge (FR, MOM, GRID, etc.) when they match a quant trade; click any row to navigate to the trade page
- **Execution log** — last 30 trades with timestamp, instrument, side, strategy tag, entry/exit price, P&L, and open/closed status; open trades show live unrealized PnL using current mark price
- **Footer** — peak equity, last tick time, funding payment count, error messages

#### Tab 2: Browser (Client-Side Bots)
Runs in the browser tab — strategies only execute while the page is open. Uses IndexedDB for persistence (survives page refresh).

- **DCA** — dollar-cost average into any Hyperliquid market on a configurable schedule
- **Grid Trading** — set a price range, auto-place buy/sell limit orders across grid levels
- **Trailing Stop** — track peak/trough price, auto-exit when price reverses by a percentage
- **Prediction Auto-Bet** — trigger Polymarket bets when odds hit your price target
- **Prediction Auto-Exit** — sell Polymarket positions before markets close
- **Copy Trading** — mirror any Hyperliquid wallet's trades in real-time
- **Price Alerts** — browser notifications when price crosses your levels
- **Activity Log** — full history of automated trades and triggered alerts

#### Tab 3: Lab (Backtesting & Analytics)
Strategy backtesting and performance analysis tools.

- **Backtest runner** — select strategy type, date range, coins, and interval; runs against historical candle data
- **Performance metrics** — total trades, win rate, total PnL, max drawdown, Sharpe ratio, profit factor
- **Data pipeline status** — candle storage counts, instruments tracked, data freshness

#### Architecture
- **Server strategies**: Contabo VPS runs `scripts/quant-server.ts` via pm2; signs orders with Hyperliquid API wallet key; writes to Supabase (`quant_strategies`, `quant_trades`, `quant_state`); frontend reads via `/api/quant/status` and `/api/quant/trades` API routes
- **Browser strategies**: Zustand store + IndexedDB; executes in the browser's event loop; uses the connected wallet for signing
- **PnL accuracy**: Fills are deduplicated by `tid` across main and xyz dexes; total PnL is computed from closed trade records (not stale engine state); funding income fetched separately from Hyperliquid's funding API
- **Risk management**: 80% max total exposure, 50% max per position, 8% daily loss limit (pauses trading for 24h), 20% kill switch (stops engine, requires manual reset), $100 reserve; position sizes scale down with drawdown (4x multiplier)
- **UI**: Page background `bg-[#0b0e11]` matches `/dashboard`; cards use `bg-[#141620] rounded-xl` (borderless); system font for numbers; subtle row separators (`border-[#2a2e3e]/30`); hover states on position and trade rows

### Unified Portfolio Dashboard (`/dashboard`)
- **Total Equity** — uses Spot USDC `total` as the single source of truth (unified account mode avoids double-counting perps backing); Available Balance = Spot total - Spot hold
- **Balance breakdown cards** — Available Balance, USDC (Perps), Spot Balance, EVM Balance
- **Portfolio chart** — Account Value and cumulative PNL over time (canvas-rendered with ResizeObserver, hover crosshair with date+time); toggle between "Account Value" and "PNL" pill tabs; reconstructs history from deposits/withdrawals (ledger API) + fills; crosshair snaps to nearest data point by time
- **Asset distribution donut** — equity breakdown: USDC (remainder after positions) + per-position value (margin + unrealized PnL); flat segment edges with gaps; center shows total equity
- Live positions list with entry/mark prices, ROE, leverage, funding fees, liquidation price
- PnL calendar — daily profit/loss heatmap with color-weighted intensity by P&L magnitude
- Trade history with round-trip grouping and per-trade P&L; open trades show live unrealized PnL, current mark price, and return percentage; closed trades show net P&L with "Missed/Saved" phantom PnL
- **Performance tab** — per-coin P&L breakdown with:
  - Overview cards: Net P&L, Win Rate, Best/Worst coin
  - Breakdown row: Gross P&L, Total Fees, Funding
  - Visual P&L bar chart per asset (sorted by profitability)
  - Sortable table: Coin, Net P&L, Trades, Win Rate, Fills, Volume, Best Trade, Worst Trade
  - Click any coin to drill down: stats grid (Gross P&L, Fees, Funding, Win Rate, Avg Win, Avg Loss) + full list of round-trip trades with direction, entry/exit, duration, fees, and P&L
- Open orders overview
- Quick-access cards for Trade, Predict, Automate
- Active automation strategies preview

### Multi-Chain Deposit Modal
- Circular deposit icon in navbar with multi-step flow (Based.app-style)
- Scans 6 blockchains (Ethereum, Arbitrum, Polygon, BNB Chain, Base, Optimism)
- Shows aggregated wallet value and per-token balances across chains
- Token selection with chain badges and USD values

### PWA (Progressive Web App)
- Installable on iOS/Android home screen — feels like a native app
- Service worker with offline caching
- Standalone display mode (no browser chrome)
- Dark splash screen matching app theme

### Coinbase-Style Navigation
- **Desktop** — all-icon circular navbar: Logo + Search pill + circular nav icons (Portfolio, Trade, Predict, Automate) with hover tooltips, separator, then utility icons (Deposit, More grid, Avatar)
- **More dropdown** — grid icon opens Traders, Journal, AI Coach, Tools
- **Search modal (Cmd+K)** — Crypto.com-style modal with category tabs (All, Favorites, Hot, Crypto, Stocks, Commodities, Forex, Indices), real-time WebSocket prices with flash animation, loading skeleton, live market data refresh
- **Brand font** — Plus Jakarta Sans (geometric, Circular Std-like) via `next/font/google`
- **Text wordmark** — logo icon + "coincess" rendered in the brand font

### Mobile-First UX
- Bottom navigation bar (Portfolio, Trade, Discover, Predict, Automate)
- Swipeable tab layout on trading terminal (Chart / Book / Order / Positions)
- Mobile card layout for positions and orders (replaces table on small screens)
- Bottom-sheet share modal with safe-area padding
- Touch-friendly controls, safe area support for notched devices
- Responsive prediction market browsing

### Embedded Wallet (Privy)
- **Email / Google / wallet login** — no MetaMask extension required
- **Arbitrum One default** — Privy is configured with `defaultChain: arbitrum` and `supportedChains: [arbitrum]`; wallet connects on Arbitrum automatically (matches based.app behavior)
- Auto-creates a self-custody embedded wallet on Arbitrum
- **External wallet priority** — when Privy detects an external wallet (Zerion, MetaMask), it uses that for signing instead of the embedded wallet, since external wallets are more likely to hold Hyperliquid deposits
- Falls back to MetaMask when Privy is not configured

### Wallet & Signing
- MetaMask / injected wallet connection
- **SDK-driven order execution** — all order placement uses the `@nktkas/hyperliquid` SDK's high-level `order()` function, which handles action construction, msgpack hashing, EIP-712 signing, nonce management, and HTTP serialization as a single atomic operation. This guarantees the client-side action hash always matches what Hyperliquid's server computes. (**Key lesson**: manually constructing + signing + POSTing L1 actions causes hash mismatches that produce "User does not exist" errors — always use the SDK's high-level functions.)
- **Agent-based trading** — one-time "Enable Trading" approval generates a local agent keypair, registers it with Hyperliquid via EIP-712 `ApproveAgent` (`signatureChainId: 0x66eee`), and stores it in `localStorage`. All subsequent orders sign silently with the agent key — no wallet popup per trade
- **Passive wallet detection** — `getConnectedAddress()` and `getSigningAddress()` use `eth_accounts` (read-only, no popup) for background checks; `eth_requestAccounts` is reserved for user-initiated connect actions. This prevents MetaMask popups when navigating between trade pairs.
- **Native MetaMask on Arbitrum for approvals** — all one-time user-signed actions (Enable Trading, builder fee, unified account) use `window.ethereum` directly, bypassing Privy's wrapped provider, and switch MetaMask to Arbitrum One before signing — matching based.one's UX
- **Address-validated signing** — every trade, cancel, and leverage update resolves the signing address consistently to prevent "User does not exist" errors
- **Wallet mismatch detection** — order form and positions table detect address mismatches between the displayed (linked) wallet and the actual signing wallet, showing a clear warning and disabling trades until resolved
- **Builder fee whitelist** — addresses in `brand.config.ts` `feeWhitelist` are exempt from builder fees (used for testing and platform-owned bots)
- **Auto builder fee approval** — if a user's builder fee hasn't been approved, the system auto-detects this, triggers approval, and retries the order transparently
- Builder fees on each Hyperliquid trade (USDC credited to builder address)
- Polymarket builder attribution via HMAC-signed headers

### Trade Journal (`/journal`)
- **Rich markdown rendering** — headings, bold, italic, lists, code blocks, blockquotes, tables, links all render with proper dark-theme styling
- **Write trade reflections** — title, content (markdown), tags, mood, coin, P&L amount
- **Tag system** — categorize entries (e.g. `brentoil`, `revenge-trading`, `lesson`, `rules`)
- **Mood tracking** — confident, tilted, neutral, learning
- **Search & filter** — find entries by keyword, tag, or mood
- **Trade data attachment** — link journal entries to specific trades
- **Persistent storage** — Supabase-backed, entries tied to wallet address

### AI Trading Coach (`/chat`)
- **Gemini-powered coach** — conversational AI that knows your trading history
- **Rich markdown responses** — AI replies render with headings, bold, lists, code, and tables
- **Live data tools** — AI fetches your current positions, recent fills, and market data from Hyperliquid
- **Journal-aware** — reads your journal entries for context when coaching
- **Rule enforcement** — references your committed trading rules (stop losses, position sizing, revenge trading limits, trend following, daily loss limits)
- **Quick actions** — "Review my positions", "Analyze recent trades", "Am I following my rules?"
- **Conversation history** — stored in Supabase per wallet

### Traders & Leaderboard (`/traders`)
- **Coincess Leaderboard** — tracks all users who trade through Coincess, ranked by Coincess-only volume, P&L, or trade count
- **Coincess-only volume tracking** — every trade records notional (size * price) in Supabase `coincess_volume` column, so the leaderboard shows only volume from Coincess, not all Hyperliquid activity
- **Hyperliquid Leaderboard** — browse the top global Hyperliquid traders by performance
- **Starred Traders tab** — bookmark any trader via the star icon; starred traders are stored in Supabase (`coincess_starred_traders` table, keyed by `user_address` + `trader_address`) with localStorage fallback; the "Starred" tab appears automatically when you have starred traders, showing name, account value, View, and Unstar actions
- **Contract Scanner** — pick a coin, scan the top 100 traders to find who holds positions in that market with entry time, size, leverage, and unrealized PnL
- **Trader profiles (`/trader/[address]`)** — dedicated profile page per wallet with Hyperbot-inspired UI:
  - **Top cards** — Account Total Value (donut: Perp vs Spot), Free Margin, Total Position Value (gross leveraged notional with leverage ratio donut), Trading Performance (win rate, max drawdown, trades, closed positions)
  - **Perp Breakdown** — Perp Total Value (sum of all position notionals), margin used ratio bar, direction bias (Bullish/Bearish/Neutral) with long/short exposure bars, position distribution (long value vs short value stacked bar), ROE, unrealized PnL
  - **PnL Chart** — SVG cumulative P&L area chart with 1D/1W/1M/ALL range selection, zero line, color-coded positive/negative areas
  - **P&L metrics row** — Total P&L, 24h/7d/30d breakdown, unrealized P&L, realized P&L, funding income
  - **Tabbed detail view** — Perp Positions (with mark price, leverage, entry time, duration, uPnL, ROE), Open Orders, Recent Fills, Spot Holdings, Funding History
- **Copy Trade** — one-click copy from any trader's open position, pre-fills your order form with side, size, and entry price
- **Position timing** — shows when each position was opened and how long it's been held
- **Empty state** — motivating "Leaderboard Awaits" design with unclaimed award slots when no traders yet
- **Bot volume attribution** — quant engine orders count as Coincess volume via the builder field + server-side Supabase tracking
- **Builder fee whitelisting** — platform owner's wallet and all managed bot accounts are exempt from builder fees (`brand.config.ts` whitelist)
- **CNC token (planned)** — future native token with tiered fee discounts based on staked CNC balance

### Quant Trading Suite (`/quant`)
- **5 automated strategies** running 24/7 on a dedicated server:
  - **Funding Rate Harvester** — scans all markets for extreme funding rates, opens opposite positions to collect hourly funding (lowest risk, ~1-3% daily target)
  - **Momentum Scalper** — EMA(9)/EMA(21) crossover with RSI confirmation on BTC, ETH, SOL 5m candles, trailing stop at 0.5%
  - **Grid Bot** — places buy/sell limit orders at fixed intervals around current price for BTC and ETH, auto-rebalances
  - **Mean Reversion** — monitors 15m RSI across top 20 coins, enters contrarian positions on RSI extremes (<25 or >75)
  - **Market Maker** — provides two-sided liquidity with dynamic spread adjustment
- **Risk management** — max 80% total exposure, 50% per position, daily loss limit (-8% pauses), kill switch at -20% drawdown, $100 reserve
- **Kelly-inspired sizing** — position sizes scale down as drawdown increases (4x drawdown multiplier)
- **Engine reset** — "Reset Engine" button clears stale drawdown, resets peak equity to current NAV, and clears error state; available inline in the risk alert banner and in the header when engine is in error
- **Live dashboard** — strategy cards with play/pause/delete, P&L stats, open positions, trade log, risk gauges; **borderless card design** matching `/dashboard` aesthetic (no outline borders, `gap-2` metric grids, system font for numbers)
- **Accurate PnL** — total P&L computed from actual closed trade records (not stale engine state); fills deduplicated by `tid` to prevent double-counting from main+xyz dex overlap
- **Server-side execution** — runs via `scripts/quant-server.ts` on Contabo VPS using pm2, no browser wallet popups
- **API Wallet** — uses Hyperliquid API wallet key (separate from main wallet) for programmatic order signing
- **Coincess volume attribution** — bot orders include the Coincess builder field and record notional volume, so all automated trades count toward platform volume and appear on the Coincess leaderboard
- **Server-side Supabase tracking** — after each successful order, the executor calls `upsert_coincess_trader` with trade notional to increment both order count and Coincess-specific volume (non-blocking, won't fail trades if Supabase is down)
- **Supabase persistence** — `quant_strategies`, `quant_trades`, `quant_state` tables track all activity
- **API routes** — `/api/quant/strategies` (CRUD), `/api/quant/trades` (history + PnL summary), `/api/quant/status` (engine health + PATCH supports `engine_status`, `max_drawdown`, `peak_equity`, `error_message`)

### Multi-Account Fleet Management
- **100-account generation** — `scripts/generate-accounts.ts` creates wallets, stores private keys securely in Supabase `coincess_accounts` table (service-role access only)
- **Automated agent approval** — `scripts/approve-agents.ts` signs EIP-712 agent approvals server-side for all accounts (no MetaMask needed since we own the keys)
- **Bulk fee whitelisting** — `scripts/whitelist-accounts.ts` reads all managed account addresses from Supabase and updates `brand.config.ts` feeWhitelist
- **Fleet runner** — `scripts/fleet-runner.ts` runs QuantEngine instances across all funded accounts, with per-account strategy assignment and periodic stats updates
- **Strategy distribution** — accounts are auto-assigned strategies round-robin (funding_rate, momentum, grid, mean_reversion, market_maker) or manually via CLI args
- **Fleet status dashboard** — `--status` flag shows all accounts grouped by strategy with funding, agent, position, and PnL info
- **Performance tracking** — per-account PnL, volume, and trade count stored in Supabase for comparing which strategies perform best

### Dayze Integration (Life OS)
- **Sync trading activity to Dayze** — trades, positions, and daily PnL appear in your Dayze personal timeline
- **API key auth** — secure connection via Dayze API keys with `activity` scope
- **Settings UI** — configure Dayze API key, base URL, test connection, enable/disable sync
- **Activity formatters** — trade closes, position opens, and daily PnL summaries formatted for Dayze's activity feed
- **Batch sync** — push multiple activities in a single request via `/api/dayze/sync`

### Leverage Calculator (`/crypto-leverage-calculator`)
- **Industry-grade perpetual futures calculator** with interactive position planning
- **Dark Coincess theme** — matches dashboard design (`bg-[#0b0e11]`, `bg-[#141620]` cards, borderless), uses the dark Navbar (not the marketing Header)
- **Up to 1000x leverage** — logarithmic slider for fine control at low values and quick access to extreme leverage; editable text input for exact values; presets: 1x, 2x, 5x, 10x, 25x, 50x, 100x, 500x, 1000x
- **Margin-locked recalculation** — when you slide leverage, margin stays fixed and quantity adjusts (the way real traders think); typing into Quantity unlocks margin recalculation
- **Exit price slider + % change** — drag slider from -50% to +100% of entry; preset buttons (-25% to +50%); live percentage change label (green/red) shows distance from entry price
- **Maker/taker fee toggle** — Hyperliquid defaults (0.010% maker, 0.035% taker), fully customizable entry & exit rates
- **Hourly funding rate** — realistic default 0.0031%/hr; calculates total funding cost over configurable trade duration
- **Break-even price** — exact price needed to cover all fees + funding before you profit
- **Liquidation price** — simplified liq estimate with margin ratio health indicator
- **Full number display** — net PNL banner shows complete dollar amounts ($8,362.50) not shorthand ($8.36K); all fees and funding amounts also show full precision
- **Interactive solver** — click into Margin (auto-sizes position), PNL (solves exit price), or ROE (solves exit price); all update live as you type
- **Cost breakdown dashboard** — entry fee, exit fee, total fees, funding cost, gross vs net PNL at a glance
- **Dark wave footer** — animated canvas waves using `screen` blending (indigo, emerald, purple glows on dark background)
- **Math reference section** — explains every formula used in the calculator

### Compounding Calculator (`/compounding-calculator`)
- **Industry-grade Monte Carlo engine** — 500 simulations with seeded PRNG (Mulberry32); same inputs always produce the same output (no flickering on re-render); deterministic seed derived from all input values
- **Probability cone chart** — P10-P90 outer shaded band, P25-P75 inner band, P50 (median) solid line, dashed linear comparison; milestone markers (2x, 5x, 10x, 25x, 50x, 100x) with axis labels
- **Drawdown chart** — underwater plot showing drawdown % from peak over time (median run); red-filled area chart; the chart professional traders look at first
- **Outcome distribution histogram** — 30-bucket histogram of final balances across all 500 runs; green bars for profitable outcomes, red for unprofitable; marks median and starting balance reference lines; shows % of runs profitable
- **Professional risk metrics** — Kelly Criterion (full + half-Kelly), Profit Factor, Payoff Ratio, Sharpe Ratio (annualized), Sortino Ratio (downside-adjusted), Risk of Ruin (P(50% drawdown)), Expected Max Drawdown (median worst), Max Consecutive Losses (expected median)
- **Streak analysis** — probability table for consecutive loss streaks (3, 5, 7, 10, 15, 20 in a row); color-coded by severity; psychologically important for traders to understand variance
- **Trader presets** — one-click profiles: Scalper (70% WR, 20 trades/week), Day Trader (55% WR, 5/week), Swing (45% WR, 2/week), Position (40% WR, 1/week); auto-fills all trade parameters
- **New inputs** — Trading Fees % (per trade, default 0.035% taker), Monthly Withdrawal ($), Reinvest % (0-100, partial compounding)
- **Capital inputs** — starting balance, monthly deposits, risk per trade (% of account), trades per week
- **Win/loss parameters** — win rate, average win %, average loss %; calculates true expectancy per trade
- **Time horizon** — slider from 1 to 120 months with presets (3m, 6m, 1y, 2y, 3y, 5y); editable text input
- **Key stats dashboard** — final balance (median), total profit, expectancy, profit factor, Kelly, Sharpe, Sortino, risk of ruin, expected max drawdown, milestones, total trades, avg monthly return, max losing streak
- **Monthly breakdown table** — scrollable table with balance, P&L, fees paid, deposits, withdrawals, drawdown %; color-coded green/red with severity-based drawdown highlighting
- **Net result banner** — median outcome summary with trade count, Sharpe ratio, and first 2x milestone
- **Dark Coincess theme** — identical design system to the leverage calculator (dark navbar, dark cards, borderless, dark wave footer)
- **Common scenarios section** — conservative, balanced, and aggressive trader profiles with expected outcomes
- **Educational content** — "The Power of Compounding", risk management principles, keys to compounding success
- **Listed on Tools page** — appears alongside Leverage Calculator with emerald accent card

### Referral System
- **Referral code: `COINCESS`** — [coincess.com/join](https://coincess.com/join) (branded ghost link that redirects to Hyperliquid)
- **Ghost link (`/join`)** — `coincess.com/join` redirects to `app.hyperliquid.xyz/join/COINCESS`, with custom OG/Twitter meta tags for social sharing ("Join Coincess — Get 4% Fee Discount")
- **Auto-referral on Enable Trading** — after a user approves their agent, Coincess automatically sends a `setReferrer` call to Hyperliquid with code `COINCESS` (best-effort, non-blocking)
- **Referral link in Deposit flow** — all external Hyperliquid links in the Deposit modal route through `/join`
- **Referral invite banner** — "New to Hyperliquid? Join via Coincess" banner in the Deposit modal with 4% fee discount messaging
- **Revenue**: Coincess earns 10% of referred users' trading fees; referred users get a 4% fee discount
- **Privacy**: The referral code does not expose the creator's EVM address — Hyperliquid only shows the code name

### Admin Dashboard (`/admin`)
- **Wallet-gated access** — only addresses in `brand.config.ts` `admin.addresses` can view
- **Tiered fee structure card** — shows Advanced (1bp, /trade) and Simple (5bp, /buy) rates side-by-side with estimated revenue at each tier; displays max approval rate and convert fee multiplier note
- **Overview metrics** — total traders, total orders, total volume, estimated revenue, builder wallet balance
- **Activity metrics** — active traders (24h / 7d), new traders (24h / 7d)
- **Bot fleet stats** — total bots, active bots, fleet volume, fleet PnL, fleet trade count
- **Top traders table** — top 20 traders by Coincess volume with address, volume, order count, last active time
- **Referral card** — one-click copy of the `coincess.com/join` referral link
- **Blog CMS (`/admin/blog`)** — create/edit/delete articles, manage categories, keywords, CTAs; publish/unpublish and feature/unfeature with one click; HTML content editor with SEO metadata fields
- **Not indexed** — `/admin` is excluded from robots.txt and sitemap

### Content & SEO (Supabase CMS)
- **Supabase-powered Blog CMS** — `blog_posts` table stores all articles (title, slug, HTML content, keywords, category, CTA config); admin panel at `/admin/blog` for CRUD; ISR (60s revalidate) serves pages via `/blog/[slug]`; graceful fallback to static `lib/blog-posts.ts` if Supabase is unreachable
- **Coincess Intelligence** — market analysis articles (oil prices, geopolitical trading, crypto guides) with trade-specific CTAs driving users to `/trade/CL`, `/trade/BRENTOIL`, etc.
- **Blog categories** — Intelligence (amber), Tutorial (blue), Security (red), Guide (green), Privacy (rose), Beginner (orange)
- **ISR blog pages** — `/blog` listing and `/blog/[slug]` article pages use Next.js ISR with 60-second revalidation; `generateStaticParams` pre-builds known slugs at build time
- **JSON-LD structured data** — Article schema + BreadcrumbList on every blog post; Organization + WebApplication + WebSite schemas on root layout
- **Dynamic sitemap** — `app/sitemap.ts` pulls published posts from Supabase (fallback to static data); blog posts get 0.85 priority for Intelligence, 0.7 for others
- **Open Graph + Twitter Cards** — per-article OG tags with title, description, published date, author, keywords; Twitter summary_large_image cards
- **Canonical URLs** — each post has `alternates.canonical` set; supports custom canonical overrides from the CMS
- **Admin Blog CMS (`/admin/blog`)** — wallet-gated CRUD panel; create/edit articles with HTML content editor, SEO description (155 char counter), keywords, category, CTA type/coins, featured/published toggles; publish/unpublish, feature/unfeature with one click
- **Migration script** — `scripts/migrate-blog-posts.ts` seeds the Supabase table with existing static articles
- **robots.txt** — allows all crawlers, disallows `/api/`, `/settings`, `/admin`
- **Extended keywords** — 18 keyword phrases covering crypto leverage trading, perpetual futures, DCA, grid trading, copy trading, portfolio tracker

## Tech Stack

- **Next.js 16** — App Router, React 19
- **TypeScript** — strict mode
- **Tailwind CSS v3** — utility-first styling
- **Zustand** — lightweight state management
- **Lightweight Charts v5** — performant financial charting
- **@nktkas/hyperliquid** — TypeScript SDK for Hyperliquid signing & API
- **@privy-io/react-auth** — embedded wallet + social login
- **Supabase** — journal & chat persistence
- **Vercel AI SDK + Gemini** — AI trading coach with tool calling
- **idb** — IndexedDB wrapper for automation persistence
- **viem** — Ethereum wallet interaction types
- **Lucide React** — icons

## Getting Started

```bash
npm install
npm run dev
```

| Route | What it does |
|-------|-------------|
| [localhost:3000/dashboard](http://localhost:3000/dashboard) | Unified portfolio dashboard |
| [localhost:3000/buy](http://localhost:3000/buy) | Simple Buy/Sell/Convert (Coinbase-style spot trading) |
| [localhost:3000/trade/BTC](http://localhost:3000/trade/BTC) | Perpetuals trading terminal (dynamic: `/trade/{TICKER}`) |
| [localhost:3000/predict](http://localhost:3000/predict) | Prediction markets browser |
| [localhost:3000/automate](http://localhost:3000/automate) | Automation dashboard |
| [localhost:3000/automate/create](http://localhost:3000/automate/create) | Create new strategy |
| [localhost:3000/automate/alerts](http://localhost:3000/automate/alerts) | Price alerts manager |
| [localhost:3000/automate/copy](http://localhost:3000/automate/copy) | Copy trading dashboard |
| [localhost:3000/quant](http://localhost:3000/quant) | Quant trading dashboard |
| [localhost:3000/journal](http://localhost:3000/journal) | Trade journal |
| [localhost:3000/chat](http://localhost:3000/chat) | AI trading coach |
| [localhost:3000/traders](http://localhost:3000/traders) | Coincess leaderboard, Hyperliquid leaderboard, starred traders, contract scanner |
| [localhost:3000/trader/0x...](http://localhost:3000/trader/0x) | Trader profile page (dynamic: `/trader/{ADDRESS}`) |
| [localhost:3000/compounding-calculator](http://localhost:3000/compounding-calculator) | Compounding growth simulator |
| [localhost:3000/scanner](http://localhost:3000/scanner) | Contract scanner |
| [localhost:3000/admin](http://localhost:3000/admin) | Admin dashboard (wallet-gated) |
| [localhost:3000/join](http://localhost:3000/join) | Referral redirect → Hyperliquid |
| [localhost:3000/settings](http://localhost:3000/settings) | Wallets, API keys, Dayze integration |

## Setup Checklist

### Required

- [ ] **Deploy to production** — Netlify or Vercel, set env vars there too
- [x] **Fund builder address** — deposit ≥100 USDC into your Hyperliquid perps account, then flip `BUILDER_FEE_ENABLED = true` in `lib/hyperliquid/signing.ts`
- [ ] **Register Polymarket builder** — go to [polymarket.com/settings?tab=builder](https://polymarket.com/settings?tab=builder), get your API keys, add to `.env.local`:
  ```
  POLYMARKET_BUILDER_KEY=your_key
  POLYMARKET_BUILDER_SECRET=your_secret
  POLYMARKET_BUILDER_PASSPHRASE=your_passphrase
  ```

### Required for Journal & AI Coach

- [ ] **Supabase** — create a project at [supabase.com](https://supabase.com), run `lib/supabase/schema.sql` in the SQL editor, add to `.env.local`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
  ```
- [ ] **Gemini API key** — get a free key from [Google AI Studio](https://aistudio.google.com/apikey), add to `.env.local`:
  ```
  GOOGLE_GENERATIVE_AI_API_KEY=your_key
  ```

### Recommended

- [ ] **Set up Privy** — sign up at [privy.io](https://privy.io), create an app, add to `.env.local`:
  ```
  NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
  ```
  This enables email/Google login with embedded wallets (no MetaMask needed)
- [ ] **App icons** — replace `public/assets/coincess-icon.png` (192x192) and `public/assets/coincess-logo.png` (512x512) for PWA splash screen
- [ ] **Custom domain** — point your domain to the deployment, update `siteUrl` in `app/layout.tsx`
- [ ] **Analytics** — the PHI tracker is already included; add Google Analytics or Plausible if desired
- [ ] **Apple App Store / Google Play** — use PWABuilder or Capacitor to wrap the PWA into native apps

### Fleet Management (100 Bot Accounts)

```bash
# 1. Run migration in Supabase SQL Editor (adds coincess_volume + coincess_accounts table)
#    Copy scripts/migrate-add-volume.sql into your Supabase Dashboard SQL Editor

# 2. Generate 100 wallets
npx tsx scripts/generate-accounts.ts 100

# 3. Whitelist all bot accounts for zero builder fees
npx tsx scripts/whitelist-accounts.ts

# 4. Fund accounts with USDC on Hyperliquid (deposit to each address)

# 5. Approve agent wallets for all funded accounts
npx tsx scripts/approve-agents.ts

# 6. Start the fleet
npx tsx scripts/fleet-runner.ts

# Check fleet status
npx tsx scripts/fleet-runner.ts --status

# Run only momentum bots
npx tsx scripts/fleet-runner.ts --strategy momentum

# Run first 10 accounts only
npx tsx scripts/fleet-runner.ts --limit 10
```

### Twitter/X Growth Engine (@coincess)

Automated content posting to grow the @coincess Twitter account.

```bash
# Add to .env.local:
# X_API_KEY=your_api_key
# X_API_SECRET=your_api_secret
# X_ACCESS_TOKEN=your_access_token
# X_ACCESS_TOKEN_SECRET=your_access_token_secret

# Preview all content types (no posting)
npx tsx scripts/twitter-engine.ts --dry-run --preview all

# Post one piece of content immediately
npx tsx scripts/twitter-engine.ts --post market    # market movers
npx tsx scripts/twitter-engine.ts --post funding   # funding rate alpha
npx tsx scripts/twitter-engine.ts --post volume    # volume update
npx tsx scripts/twitter-engine.ts --post thread    # educational thread
npx tsx scripts/twitter-engine.ts --post engage    # engagement post

# Run the scheduler (posts 8x/day at optimal times)
npx tsx scripts/twitter-engine.ts

# Production (24/7 on VPS via pm2)
pm2 start "npx tsx scripts/twitter-engine.ts" --name coincess-twitter
```

**Daily schedule (UTC):**
| Time | Content |
|------|---------|
| 07:00 | Market Movers (top gainers/losers) |
| 09:00 | Engagement (polls, hot takes) |
| 11:00 | Funding Rate Alpha (farming opportunities) |
| 13:00 | Engagement |
| 15:00 | Volume Update (top traded coins) |
| 17:00 | Educational Thread (4-6 tweet threads) |
| 19:00 | Engagement |
| 21:00 | Market Recap |

**Content types:** Market movers with live Hyperliquid data, funding rate alpha, 24h volume stats, educational threads (funding farming, grid trading, position management, common mistakes), engagement posts (polls, opinions, questions).

**Setup:** Create a developer app at [developer.x.com](https://developer.x.com), enable read+write permissions under User Authentication Settings, copy the 4 OAuth 1.0a keys to `.env.local`.

### Optional / Future

- [ ] **CNC token tiered builder fees** — Coincess's native token. Users who stake CNC get reduced trading fees (discount on both Simple and Advanced tiers):

  | Tier | CNC Staked | Simple Fee | Advanced Fee |
  |------|------------|------------|--------------|
  | Free | 0 | 5bp (0.05%) | 1bp (0.01%) |
  | Bronze | 1,000 CNC | 4bp | 0.8bp |
  | Silver | 10,000 CNC | 2.5bp | 0.5bp |
  | Gold | 100,000 CNC | 1bp | 0.2bp |
  | Diamond | 1,000,000 CNC | 0bp | 0bp |

  Implementation: read user's staked CNC balance from on-chain contract (Solana SPL), pass dynamic `f` value to the builder field per order via `builderFee` param.

- [ ] **UI sounds** — audio feedback for order placed, order filled, order cancelled, position closed, errors (like Binance/HL trading terminal sounds). Toggle in Settings
- [ ] **Visa debit card** — partner with a whitelabel card provider (e.g., Reap, Immersve) for crypto spend
- [ ] **Server-side automation** — move strategies to Supabase Edge Functions for 24/7 execution without browser open
- [ ] **Telegram bot** — add a `/trade` and `/alert` bot for notifications and quick orders
- [ ] **Social features** — leaderboard, strategy sharing, social feed of top traders
- [ ] **Token scanner / GMGN-style features** — new token alerts, smart money tracking, contract security checks (see "GMGN Integration" below)

## Project Structure

```
coincess/
├── app/
│   ├── dashboard/page.tsx               # Unified portfolio dashboard (Assets, History, Performance, PnL Calendar)
│   ├── buy/page.tsx                       # Simple Buy/Sell/Convert (Coinbase-style, 5bp fee)
│   ├── trade/
│   │   ├── page.tsx                     # Redirects to last ticker or /trade/BTC
│   │   ├── [coin]/page.tsx              # Perpetuals trading terminal (1bp fee)
│   ├── predict/
│   │   ├── page.tsx                     # Prediction markets browser
│   │   └── [slug]/page.tsx             # Event detail + bet slips
│   ├── automate/
│   │   ├── page.tsx                     # Automation dashboard
│   │   ├── create/page.tsx             # Create strategy (DCA, Grid, etc.)
│   │   ├── alerts/page.tsx             # Price alerts manager
│   │   └── copy/page.tsx              # Copy trading dashboard
│   ├── journal/page.tsx                # Trade journal
│   ├── chat/page.tsx                   # AI trading coach
│   ├── quant/page.tsx                  # Quant trading dashboard
│   ├── traders/page.tsx                # Trader lookup & leaderboard & starred
│   ├── trader/[address]/page.tsx      # Individual trader profile (Hyperbot-style)
│   ├── scanner/page.tsx                # Contract scanner
│   ├── api/
│   │   ├── journal/route.ts            # Journal CRUD API
│   │   ├── chat/route.ts              # AI chat streaming (Gemini + tools)
│   │   ├── quant/strategies/route.ts   # Quant strategy CRUD
│   │   ├── quant/trades/route.ts       # Quant trade history
│   │   ├── quant/status/route.ts       # Quant engine health
│   │   ├── dayze/sync/route.ts        # Dayze activity sync proxy
│   │   ├── polymarket/events/          # Gamma API proxy (CORS)
│   │   ├── polymarket/tags/            # Tags proxy
│   │   ├── polymarket/search/          # Search proxy
│   │   ├── polymarket/sign/            # Builder attribution signing
│   │   └── news/                       # News API
│   ├── compounding-calculator/page.tsx  # Compounding growth simulator
│   ├── coins/page.tsx                  # Market overview
│   ├── blog/
│   │   ├── page.tsx                    # Blog listing (ISR, Supabase + fallback)
│   │   ├── [slug]/page.tsx            # Dynamic article page (ISR, JSON-LD)
│   │   └── .../page.tsx               # Legacy static articles (fallback)
│   └── page.tsx                        # Landing page
├── components/
│   ├── AppShell.tsx                    # Client shell (Privy + MobileNav + AlertBanner)
│   ├── MobileNav.tsx                   # Bottom navigation bar
│   ├── CompoundingCalculator.tsx        # Industry-grade Monte Carlo compounding simulator (500 runs, percentile bands, risk metrics, drawdown/histogram charts)
│   ├── DarkWaveFooter.tsx              # Dark-mode animated wave footer (screen blending)
│   ├── ConnectButton.tsx               # Unified wallet connect button
│   ├── WalletProvider.tsx              # Privy embedded wallet provider
│   ├── trade/                          # Trading terminal components
│   ├── predictions/                    # Prediction market components
│   └── automate/                       # Automation UI components
├── lib/
│   ├── hyperliquid/
│   │   ├── api.ts                      # REST API client
│   │   ├── agent.ts                    # Agent keypair storage (localStorage)
│   │   ├── signing.ts                  # EIP-712 signing, agent approval, builder fees
│   │   ├── wallet.ts                   # Wallet adapter
│   │   ├── websocket.ts               # WebSocket client
│   │   ├── store.ts                    # Zustand store
│   │   └── types.ts                    # TypeScript interfaces
│   ├── coinLogos.ts                     # Multi-tier logo resolver (local, Clearbit, CoinCap, emoji)
│   ├── polymarket/
│   │   ├── api.ts                      # Gamma API + CLOB client
│   │   ├── trading.ts                  # Order placement via CLOB
│   │   ├── store.ts                    # Zustand store
│   │   ├── builder.ts                  # Builder HMAC signing
│   │   └── types.ts                    # TypeScript interfaces
│   ├── quant/
│   │   ├── engine.ts                   # Quant engine: tick loop, strategy orchestration
│   │   ├── executor.ts                 # Server-side order execution (API wallet)
│   │   ├── risk.ts                     # Risk manager: limits, drawdown, kill switch
│   │   ├── indicators.ts              # Technical indicators: EMA, RSI, ATR, Bollinger
│   │   ├── types.ts                    # Shared quant types
│   │   └── strategies/
│   │       ├── funding-rate.ts         # Funding rate harvester
│   │       ├── momentum.ts            # EMA crossover momentum scalper
│   │       ├── grid.ts                # Server-side grid bot
│   │       └── mean-reversion.ts      # RSI mean reversion
│   ├── automation/
│   │   ├── engine.ts                   # Strategy execution engine
│   │   ├── store.ts                    # Zustand store
│   │   ├── storage.ts                  # IndexedDB persistence
│   │   ├── types.ts                    # Strategy/alert types
│   │   └── strategies/
│   │       ├── dca.ts                  # Dollar-cost averaging
│   │       ├── grid.ts                 # Grid trading
│   │       ├── trailing-stop.ts        # Trailing stop loss
│   │       ├── copy-trade.ts           # Copy trading
│   │       ├── prediction-auto-bet.ts  # Auto-bet on predictions
│   │       └── prediction-exit.ts      # Auto-exit predictions
│   ├── ai/
│   │   ├── system-prompt.ts            # AI coach system prompt + trading rules
│   │   └── tools.ts                    # AI tools (positions, fills, journal, market data)
│   ├── dayze/
│   │   └── sync.ts                     # Dayze activity sync + formatters
│   ├── blog/
│   │   └── index.ts                    # Blog data layer (Supabase + static fallback)
│   ├── supabase/
│   │   ├── client.ts                   # Supabase client (lazy-initialized)
│   │   └── schema.sql                  # Database schema (journal + chat tables)
│   └── alerts/
│       └── engine.ts                   # Alert evaluation + notifications
├── scripts/
│   ├── generate-accounts.ts            # Generate N trading wallets → Supabase
│   ├── approve-agents.ts              # Approve Hyperliquid agents for all accounts
│   ├── fleet-runner.ts                # Run quant strategies across all accounts
│   ├── whitelist-accounts.ts          # Update brand.config.ts feeWhitelist
│   ├── create-traders-table.sql       # Full schema (fresh install)
│   ├── migrate-add-volume.sql         # Migration: add coincess_volume + accounts table
│   └── migrate-blog-posts.ts         # Seed blog_posts table from static content
├── public/
│   ├── manifest.json                   # PWA manifest
│   ├── sw.js                           # Service worker
│   └── assets/                         # Icons and images
└── package.json
```

## Revenue Model

### 1. Hyperliquid Builder Fees (Tiered)

Configure in `lib/brand.config.ts`:

```ts
builder: {
  address: "0xYOUR_ADDRESS",
  fee: 10,              // Advanced tier: 10 = 1bp = 0.01% (/trade)
  simpleFee: 50,        // Simple tier:   50 = 5bp = 0.05% (/buy)
  maxFeeApproval: "0.05%", // Max approved upfront (covers both tiers)
  enabled: true,
}
```

**Tiered fee structure:**

| Tier | Route | Fee | Who |
|------|-------|-----|-----|
| **Simple** | `/buy` (Buy/Sell/Convert) | 5bp (0.05%) | Casual traders, Coinbase-style |
| **Advanced** | `/trade` (perps + spot terminal) | 1bp (0.01%) | Pro traders |

- Convert = 2 market orders = **2x the fee** (e.g. 10bp total for simple)
- Still **15-30x cheaper than Coinbase** even at the simple rate
- Users approve the max fee (0.05%) once; actual fee per order varies by route
- Fee is passed as `builderFee` in `signAndPlaceOrder()` — defaults to advanced rate

**How it works:**
- Each order includes a `builder: { b: address, f: fee }` field
- The fee is expressed in **tenths of a basis point** — so `10` = 1bp = 0.01% of notional
- Max allowed: 0.1% (= 100 in tenths of a basis point) on perps
- **Where the money goes:** Hyperliquid deducts the fee in **USDC** from the trader's margin/account and credits it directly to the builder address's Hyperliquid perps account
- Builder address must have **≥100 USDC** deposited in its Hyperliquid perps account to be eligible
- Each user must first approve the builder's max fee via `approveBuilderFee` (EIP-712 typed data signed once per user)
- The platform owner's address is automatically exempted from builder fees

### 2. Hyperliquid Referral

The referral code `COINCESS` is configured in `lib/brand.config.ts`:

```ts
referral: {
  code: "COINCESS",
  link: "https://app.hyperliquid.xyz/join/COINCESS",
  ghostLink: "/join",
}
```

**How it works:**
- **Share `coincess.com/join`** — branded ghost link with OG meta tags, redirects to Hyperliquid referral
- When a new user clicks "Enable Trading", after agent approval succeeds, Coincess auto-sends `setReferrer` with code `COINCESS` to Hyperliquid
- All external Hyperliquid links in the Deposit modal use `/join`
- You earn **10% of referred users' fees**, and they get a **4% discount**
- The referral code creator's wallet address is **not exposed** — only the code name is visible

### 3. Polymarket Builder Attribution

Configure in `.env.local`:

```
POLYMARKET_BUILDER_KEY=your_key
POLYMARKET_BUILDER_SECRET=your_secret
POLYMARKET_BUILDER_PASSPHRASE=your_passphrase
```

- Register at [polymarket.com/settings?tab=builder](https://polymarket.com/settings?tab=builder)
- No minimum balance required
- Weekly USDC payouts based on your share of total builder volume

## HIP-3 Markets

Non-crypto perpetuals on Hyperliquid's "xyz" DEX:

| Category | Examples |
|----------|----------|
| Stocks | TSLA, AAPL, NVDA, AMZN, GOOGL, META |
| Commodities | Brent Oil, WTI Crude, Gold, Silver, Natural Gas |
| Forex | EUR/USD, GBP/USD, USD/JPY |
| Indices | S&P 500, Nasdaq, Dow Jones |

## Building for Production

```bash
npm run build   # uses webpack mode for Privy compatibility
npm start
```

## License

Private project — All rights reserved.
