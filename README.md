# Coincess

A unified crypto trading super-app combining **perpetual futures** (Hyperliquid), **prediction markets** (Polymarket), and **automated strategies** — all in a single mobile-first PWA. Coincess earns builder/affiliate fees on every trade.

## Features

### Perpetual Futures Trading
- **279 perpetual markets** — crypto (BTC, ETH, SOL, memecoins, AI tokens) + HIP-3 markets (stocks, commodities, forex, indices)
- **Real-time order book** and recent trades via WebSocket
- **Interactive TradingView-style charts** with candlestick + volume, multiple timeframes
- **Unified Account support** — enables trading HIP-3/RWA markets (stocks, commodities, forex); order form reads spot clearinghouse balance for accurate "Available" display
- **Order placement** — market & limit orders, long/short, configurable leverage, TP/SL
- **Position management** — open positions, unrealized PnL, ROE; close at limit price, market close, reverse position, and set TP/SL inline (Hyperliquid-style actions)
- **Order management** — compact single-row open orders table with inline edit for size/price, placed date, duration with seconds, and cancel all
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

### Automation Suite
- **DCA** — dollar-cost average into any Hyperliquid market on a schedule
- **Grid Trading** — set a price range, auto-place buy/sell limit orders across grid levels
- **Trailing Stop** — track peak/trough, auto-exit when price reverses by a percentage
- **Prediction Auto-Bet** — trigger bets when Polymarket odds hit your price target
- **Prediction Auto-Exit** — sell positions before markets close
- **Copy Trading** — mirror any Hyperliquid wallet's trades in real-time
- **Price Alerts** — browser notifications when price crosses your levels
- **Activity Log** — full history of automated trades and triggered alerts
- All strategies persist in IndexedDB (survives page refresh)

### Unified Portfolio Dashboard (`/dashboard`)
- **Combined balance** — uses Spot USDC `total` as the single source of truth (unified account mode avoids double-counting perps backing); Available Balance = Spot total - Spot hold
- **Balance breakdown cards** — Available Balance, USDC (Perps), Spot Balance, EVM Balance
- **Portfolio chart** — Account Value and cumulative PNL over time (canvas-rendered, hover crosshair); toggle between "Account Value" and "PNL" tabs; data derived from fills history
- **Asset distribution donut** — visual split of Spot USDC vs open position margins
- Live positions list with entry/mark prices, ROE, leverage, funding fees, liquidation price
- PnL calendar — daily profit/loss heatmap
- Trade history with round-trip grouping and per-trade P&L
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
- **Search** — unified rounded pill replaces the old Discover link, searches markets on Enter
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
- **Trader profiles** — click any trader to view their open positions, account value, and trade history
- **Star/Favorite traders** — bookmark traders to track them across sessions (persisted in Supabase)
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
- **Risk management** — max 50% exposure, 10% per position, daily loss limit (-5% pauses), kill switch at -15% drawdown
- **Kelly-inspired sizing** — position sizes scale down as drawdown increases
- **Live dashboard** — strategy cards with play/pause/delete, P&L stats, open positions, trade log, risk gauges
- **Server-side execution** — runs via `scripts/quant-server.ts` on Contabo VPS using pm2, no browser wallet popups
- **API Wallet** — uses Hyperliquid API wallet key (separate from main wallet) for programmatic order signing
- **Coincess volume attribution** — bot orders include the Coincess builder field and record notional volume, so all automated trades count toward platform volume and appear on the Coincess leaderboard
- **Server-side Supabase tracking** — after each successful order, the executor calls `upsert_coincess_trader` with trade notional to increment both order count and Coincess-specific volume (non-blocking, won't fail trades if Supabase is down)
- **Supabase persistence** — `quant_strategies`, `quant_trades`, `quant_state` tables track all activity
- **API routes** — `/api/quant/strategies` (CRUD), `/api/quant/trades` (history), `/api/quant/status` (engine health)

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
- **Maker/taker fee toggle** — Hyperliquid defaults (0.01% maker, 0.035% taker), fully customizable entry & exit rates
- **Hourly funding rate** — calculates total funding cost over configurable trade duration (hours)
- **Break-even price** — exact price needed to cover all fees + funding before you profit
- **Liquidation price** — simplified liq estimate with margin ratio health indicator
- **Position notional** — shows actual dollar exposure at your leverage
- **Net PNL & Net ROE** — after subtracting trading fees + funding, not just gross numbers
- **Interactive solver** — click into Margin (auto-sizes position), PNL (solves exit price), or ROE (solves exit price); all update live as you type
- **Cost breakdown dashboard** — entry fee, exit fee, total fees, funding cost, gross vs net PNL at a glance
- **Math reference section** — explains every formula used in the calculator

### Content & SEO
- Landing page with crypto education content
- Blog with articles on wallets, privacy, swapping
- SEO-optimized pages with sitemap and schema.org markup

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
| [localhost:3000/trade/BTC](http://localhost:3000/trade/BTC) | Perpetuals trading terminal (dynamic: `/trade/{TICKER}`) |
| [localhost:3000/predict](http://localhost:3000/predict) | Prediction markets browser |
| [localhost:3000/automate](http://localhost:3000/automate) | Automation dashboard |
| [localhost:3000/automate/create](http://localhost:3000/automate/create) | Create new strategy |
| [localhost:3000/automate/alerts](http://localhost:3000/automate/alerts) | Price alerts manager |
| [localhost:3000/automate/copy](http://localhost:3000/automate/copy) | Copy trading dashboard |
| [localhost:3000/quant](http://localhost:3000/quant) | Quant trading dashboard |
| [localhost:3000/journal](http://localhost:3000/journal) | Trade journal |
| [localhost:3000/chat](http://localhost:3000/chat) | AI trading coach |
| [localhost:3000/traders](http://localhost:3000/traders) | Coincess leaderboard, Hyperliquid leaderboard, trader profiles, copy trade |
| [localhost:3000/scanner](http://localhost:3000/scanner) | Contract scanner |
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

- [ ] **CNC token tiered builder fees** — Coincess's native token. Users who stake CNC get reduced trading fees:

  | Tier | CNC Staked | Builder Fee |
  |------|------------|-------------|
  | Free | 0 | 1bp (0.01%) |
  | Bronze | 1,000 CNC | 0.8bp |
  | Silver | 10,000 CNC | 0.5bp |
  | Gold | 100,000 CNC | 0.2bp |
  | Diamond | 1,000,000 CNC | 0bp (fee-free) |

  Implementation: read user's staked CNC balance from on-chain contract (Solana SPL), pass dynamic `f` value to the builder field per order.

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
│   ├── dashboard/page.tsx               # Unified portfolio dashboard
│   ├── trade/
│   │   ├── page.tsx                     # Redirects to last ticker or /trade/BTC
│   │   ├── [coin]/page.tsx              # Perpetuals trading terminal
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
│   ├── traders/page.tsx                # Trader lookup & leaderboard
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
│   ├── coins/page.tsx                  # Market overview
│   ├── blog/                           # Blog articles
│   └── page.tsx                        # Landing page
├── components/
│   ├── AppShell.tsx                    # Client shell (Privy + MobileNav + AlertBanner)
│   ├── MobileNav.tsx                   # Bottom navigation bar
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
│   └── migrate-add-volume.sql         # Migration: add coincess_volume + accounts table
├── public/
│   ├── manifest.json                   # PWA manifest
│   ├── sw.js                           # Service worker
│   └── assets/                         # Icons and images
└── package.json
```

## Revenue Model

### 1. Hyperliquid Builder Fees

Configure in `lib/brand.config.ts`:

```ts
builder: {
  address: "0xYOUR_ADDRESS",
  fee: 10,              // in tenths of a basis point (10 = 1bp = 0.01%)
  enabled: true,        // flip to true once funded
}
```

**How it works:**
- Each order includes a `builder: { b: address, f: fee }` field
- The fee is expressed in **tenths of a basis point** — so `10` = 1bp = 0.01% of notional
- Max allowed: 0.1% (= 100 in tenths of a basis point) on perps
- **Where the money goes:** Hyperliquid deducts the fee in **USDC** from the trader's margin/account and credits it directly to the builder address's Hyperliquid perps account
- Builder address must have **≥100 USDC** deposited in its Hyperliquid perps account to be eligible
- Each user must first approve the builder's max fee via `approveBuilderFee` (EIP-712 typed data signed once per user)
- The platform owner's address is automatically exempted from builder fees

### 2. Polymarket Builder Attribution

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
