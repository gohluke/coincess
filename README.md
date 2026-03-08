# Coincess

A unified crypto trading super-app combining **perpetual futures** (Hyperliquid), **prediction markets** (Polymarket), and **automated strategies** — all in a single mobile-first PWA. Coincess earns builder/affiliate fees on every trade.

## Features

### Perpetual Futures Trading
- **279 perpetual markets** — crypto (BTC, ETH, SOL, memecoins, AI tokens) + HIP-3 markets (stocks, commodities, forex, indices)
- **Real-time order book** and recent trades via WebSocket
- **Interactive TradingView-style charts** with candlestick + volume, multiple timeframes
- **Order placement** — market & limit orders, long/short, configurable leverage, TP/SL
- **Position management** — open positions, unrealized PnL, ROE, close positions
- **Order management** — view and cancel open orders

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
- Total account value, unrealized PnL, margin used, active bots
- Live positions list with entry/mark prices and ROE
- Open orders overview
- Quick-access cards for Trade, Predict, Automate
- Active automation strategies preview

### PWA (Progressive Web App)
- Installable on iOS/Android home screen — feels like a native app
- Service worker with offline caching
- Standalone display mode (no browser chrome)
- Dark splash screen matching app theme

### Mobile-First UX
- Bottom navigation bar (Portfolio, Trade, Predict, Automate)
- Swipeable tab layout on trading terminal (Chart / Book / Order / Positions)
- Touch-friendly controls, safe area support for notched devices
- Responsive prediction market browsing

### Embedded Wallet (Privy)
- **Email / Google / wallet login** — no MetaMask extension required
- Auto-creates a self-custody embedded wallet on Arbitrum
- Falls back to MetaMask when Privy is not configured

### Wallet & Signing
- MetaMask / injected wallet connection
- EIP-712 signing via Hyperliquid's phantom agent scheme
- Builder fees on each Hyperliquid trade
- Polymarket builder attribution via HMAC-signed headers

### Content & SEO
- Landing page with crypto education content
- Blog with articles on wallets, privacy, swapping
- Crypto leverage calculator tool
- SEO-optimized pages with sitemap and schema.org markup

## Tech Stack

- **Next.js 16** — App Router, React 19
- **TypeScript** — strict mode
- **Tailwind CSS v3** — utility-first styling
- **Zustand** — lightweight state management
- **Lightweight Charts v5** — performant financial charting
- **@nktkas/hyperliquid** — TypeScript SDK for Hyperliquid signing & API
- **@privy-io/react-auth** — embedded wallet + social login
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
| [localhost:3000/trade](http://localhost:3000/trade) | Perpetuals trading terminal |
| [localhost:3000/predictions](http://localhost:3000/predictions) | Prediction markets browser |
| [localhost:3000/automate](http://localhost:3000/automate) | Automation dashboard |
| [localhost:3000/automate/create](http://localhost:3000/automate/create) | Create new strategy |
| [localhost:3000/automate/alerts](http://localhost:3000/automate/alerts) | Price alerts manager |
| [localhost:3000/automate/copy](http://localhost:3000/automate/copy) | Copy trading dashboard |

## Setup Checklist

### Required

- [ ] **Deploy to production** — Netlify or Vercel, set env vars there too
- [ ] **Fund builder address** — deposit ≥100 USDC into your Hyperliquid perps account, then flip `BUILDER_FEE_ENABLED = true` in `lib/hyperliquid/signing.ts`
- [ ] **Register Polymarket builder** — go to [polymarket.com/settings?tab=builder](https://polymarket.com/settings?tab=builder), get your API keys, add to `.env.local`:
  ```
  POLYMARKET_BUILDER_KEY=your_key
  POLYMARKET_BUILDER_SECRET=your_secret
  POLYMARKET_BUILDER_PASSPHRASE=your_passphrase
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

### Optional / Future

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
│   ├── trade/page.tsx                   # Perpetuals trading terminal
│   ├── predictions/
│   │   ├── page.tsx                     # Prediction markets browser
│   │   └── [slug]/page.tsx             # Event detail + bet slips
│   ├── automate/
│   │   ├── page.tsx                     # Automation dashboard
│   │   ├── create/page.tsx             # Create strategy (DCA, Grid, etc.)
│   │   ├── alerts/page.tsx             # Price alerts manager
│   │   └── copy/page.tsx              # Copy trading dashboard
│   ├── api/
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
│   │   ├── signing.ts                  # EIP-712 signing + builder fees
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
│   └── alerts/
│       └── engine.ts                   # Alert evaluation + notifications
├── public/
│   ├── manifest.json                   # PWA manifest
│   ├── sw.js                           # Service worker
│   └── assets/                         # Icons and images
└── package.json
```

## Revenue Model

### 1. Hyperliquid Builder Fees

Configure in `lib/hyperliquid/signing.ts`:

```ts
const BUILDER_ADDRESS = "0xYOUR_ADDRESS";
const BUILDER_FEE = 10;              // 1bp = 0.01%
const BUILDER_FEE_ENABLED = true;    // flip to true once funded
```

- Builder address needs **≥100 USDC** in Hyperliquid perps account
- Fee added to each order: `builder: { b: address, f: fee }`
- Max fee: 0.1% (100 in tenths of a basis point) on perps

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
