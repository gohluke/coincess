# Coincess

A unified crypto trading platform combining **perpetual futures** (via Hyperliquid DEX) and **prediction markets** (via Polymarket) into a single broker UI. All execution happens on decentralized infrastructure — Coincess earns builder/affiliate fees on every trade.

## Features

### Perpetual Futures Trading
- **279 perpetual markets** — crypto (BTC, ETH, SOL, memecoins, AI tokens, etc.) + HIP-3 markets (stocks, commodities, forex, indices)
- **Real-time order book** and recent trades via WebSocket
- **Interactive TradingView-style charts** with candlestick + volume, multiple timeframes
- **Order placement** — market & limit orders, long/short, configurable leverage, TP/SL
- **Position management** — open positions, unrealized PnL, ROE, close positions
- **Order management** — view and cancel open orders

### Prediction Markets
- **Browse trending events** — politics, sports, crypto, pop culture, business, science, technology
- **Category filtering** — tabs for each major category, powered by Polymarket's Gamma API
- **Search** — find specific markets by keyword
- **Event detail pages** — full market descriptions, all outcomes, volume/liquidity stats
- **Bet slips** — Buy Yes/No with potential payout calculator
- **Infinite scroll** — load more events as you scroll

### Wallet & Signing
- **MetaMask / injected wallet** connection
- **EIP-712 signing** via Hyperliquid's phantom agent scheme (using `@nktkas/hyperliquid` SDK)
- **Builder fees** — configurable fee on each Hyperliquid trade (up to 0.1% on perps)
- **Polymarket builder attribution** — HMAC-signed headers for order attribution

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
- **viem** — Ethereum wallet interaction types
- **Lucide React** — icons

## Getting Started

```bash
npm install
npm run dev
```

| Route | What it does |
|-------|-------------|
| [localhost:3000](http://localhost:3000) | Landing page |
| [localhost:3000/trade](http://localhost:3000/trade) | Perpetuals trading terminal |
| [localhost:3000/predictions](http://localhost:3000/predictions) | Prediction markets browser |

## Project Structure

```
coincess/
├── app/
│   ├── trade/page.tsx                 # Perpetuals trading terminal
│   ├── predictions/
│   │   ├── page.tsx                   # Prediction markets browser
│   │   └── [slug]/page.tsx            # Event detail + bet slips
│   ├── api/
│   │   ├── polymarket/events/         # Gamma API proxy (CORS)
│   │   ├── polymarket/tags/           # Tags proxy
│   │   ├── polymarket/sign/           # Builder attribution signing
│   │   └── news/                      # News API
│   ├── coins/page.tsx                 # Market overview
│   ├── blog/                          # Blog articles
│   └── page.tsx                       # Landing page
├── components/
│   ├── trade/
│   │   ├── MarketSelector.tsx         # Market search, categories, HIP-3 badges
│   │   ├── TradingChart.tsx           # Candlestick + volume chart
│   │   ├── OrderBook.tsx              # Real-time L2 order book
│   │   ├── OrderForm.tsx              # Order placement form
│   │   ├── PositionsTable.tsx         # Positions & orders management
│   │   ├── RecentTrades.tsx           # Recent trade feed
│   │   └── WalletButton.tsx           # Wallet connect/disconnect
│   ├── predictions/
│   │   ├── EventCard.tsx              # Event card with price bars
│   │   ├── EventGrid.tsx              # Infinite-scroll grid
│   │   ├── CategoryTabs.tsx           # Category filter tabs
│   │   ├── SearchBar.tsx              # Search input
│   │   └── MarketRow.tsx              # Market detail with Buy Yes/No
│   ├── Header.tsx                     # Main navigation
│   ├── Footer.tsx
│   └── ui/                            # shadcn/ui components
├── lib/
│   ├── hyperliquid/
│   │   ├── api.ts                     # REST API client
│   │   ├── signing.ts                 # EIP-712 signing (orders, cancels, leverage)
│   │   ├── wallet.ts                  # MetaMask wallet adapter
│   │   ├── websocket.ts              # WebSocket client
│   │   ├── store.ts                   # Zustand store
│   │   ├── categories.ts             # Market categorization
│   │   └── types.ts                   # TypeScript interfaces
│   └── polymarket/
│       ├── api.ts                     # Gamma API + CLOB client
│       ├── store.ts                   # Zustand store (events, search, categories)
│       ├── builder.ts                 # Builder attribution (HMAC signing)
│       └── types.ts                   # TypeScript interfaces
└── public/
    └── assets/
```

## Revenue Model

Coincess earns from two sources:

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
- Claim via `POST /info {"type": "referral", "user": "0x..."}`

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
- Estimated revenue: 0.5–1% of attributed trading volume

## HIP-3 Markets

Non-crypto perpetuals on Hyperliquid's "xyz" DEX:

| Category | Examples |
|----------|----------|
| Stocks | TSLA, AAPL, NVDA, AMZN, GOOGL, META |
| Commodities | Brent Oil, WTI Crude, Gold, Silver, Natural Gas |
| Forex | EUR/USD, GBP/USD, USD/JPY |
| Indices | S&P 500, Nasdaq, Dow Jones |

## How Signing Works

Hyperliquid uses a "phantom agent" EIP-712 signing scheme:

1. Action is msgpack-encoded and keccak256-hashed → `connectionId`
2. User signs `Agent { source: "a", connectionId }` with domain chain ID `1337`
3. The `@nktkas/hyperliquid` SDK handles this automatically

For user-signed actions (e.g. `approveBuilderFee`), the action fields are signed directly with the user's chain ID.

## Building for Production

```bash
npm run build
npm start
```

## License

Private project — All rights reserved.
