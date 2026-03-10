# White-Label Rebrand Checklist

Follow these steps to create a new branded version of this app.

## Prerequisites

- Node.js 18+
- A GitHub account (for the new repo)
- A Netlify or Vercel account (for deployment)
- A Privy app ID for the new brand
- Logo assets (icon 192x192 PNG, logo 512x512 PNG, favicon PNG)

## Steps

### 1. Fork / clone the repo

```bash
git clone git@github.com:gohluke/coincess.git my-dex
cd my-dex
git remote set-url origin git@github.com:YOUR_ORG/my-dex.git
```

### 2. Update `lib/brand.config.ts`

This is the **only config file** you need to edit. Change every field:

| Field | Example |
|-------|---------|
| `name` | `"MyDEX"` |
| `nameLower` | `"mydex"` |
| `tagline` | `"Your tagline"` |
| `description` | `"Full description..."` |
| `url` | `"https://mydex.com"` |
| `twitter` | `"@mydex"` |
| `colors.hex` | `"#00C853"` (your primary color) |
| `colors.hover` | `"#00A844"` (slightly darker) |
| `colors.rgb` | `"0, 200, 83"` (same as hex, in RGB) |
| `colors.hoverRgb` | `"0, 168, 68"` |
| `assets.icon` | `"/assets/mydex-icon.png"` |
| `assets.logo` | `"/assets/mydex-logo.png"` |
| `assets.favicon` | `"/favicon.png"` |
| `pwa.themeColor` | `"#00C853"` (match colors.hex) |

> **Note:** `builder.address`, `builder.fee`, and `builder.enabled` control fee collection.
> By default they point to the original builder address. Change only if you want a different fee recipient.

### 3. Replace logo assets

Drop your new images into `public/assets/`:

- `public/assets/mydex-icon.png` — 192x192, used in nav + PWA
- `public/assets/mydex-logo.png` — 512x512, used in OG image + PWA
- `public/favicon.png` — browser tab icon

Make sure the filenames match what you set in `brand.config.ts`.

### 4. Update CSS variables in `app/globals.css`

Find the `--brand` variables in both `:root` and `.dark` blocks and update them to match your new colors:

```css
--brand: 0 200 83;             /* colors.rgb */
--brand-hex: #00C853;          /* colors.hex */
--brand-hover: 0 168 68;       /* colors.hoverRgb */
--brand-hover-hex: #00A844;    /* colors.hover */
```

### 5. Create `.env.local`

Copy from the original and update:

```env
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
# ... other env vars
```

### 6. Test locally

```bash
npm install
npm run dev
```

Verify:
- [ ] Logo shows your brand icon and name
- [ ] Page title reads "MyDEX - Your tagline"
- [ ] PWA manifest has correct name, colors, and icons (check `/manifest.webmanifest`)
- [ ] PNL share card shows your brand name and URL
- [ ] Wallet connect modal shows your icon
- [ ] Colors match throughout the app

### 7. Deploy

Push to your repo and connect to Netlify/Vercel:

```bash
git add -A
git commit -m "Rebrand to MyDEX"
git push -u origin main
```

### 8. Staying up to date (optional)

To pull new features from the upstream Coincess repo:

```bash
git remote add upstream git@github.com:gohluke/coincess.git
git fetch upstream
git cherry-pick <commit-hash>
# or merge the full branch:
git merge upstream/main
```

## Files that read from BRAND_CONFIG

For reference, these are the files that import and use `BRAND_CONFIG`:

| File | What it reads |
|------|--------------|
| `app/layout.tsx` | name, tagline, description, url, twitter, assets, pwa |
| `app/manifest.ts` | name, description, pwa, assets |
| `lib/hyperliquid/signing.ts` | builder.address, builder.fee, builder.enabled |
| `components/Logo.tsx` | assets.icon, nameLower |
| `components/WalletProvider.tsx` | colors.hex, assets.icon |
| `components/trade/PositionsTable.tsx` | colors.hex, nameLower, url |
| `components/trade/TradingChart.tsx` | colors (via BRAND re-export) |
| `app/dashboard/page.tsx` | colors (via BRAND re-export) |
| `app/globals.css` | CSS vars must match colors manually |
