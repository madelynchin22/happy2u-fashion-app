# Happy2U Fashion Management System — Developer Handover

## Live App
- **URL**: https://happy2u-fashion-app-production.up.railway.app
- **Login**: admin@happy2u.my / Happy2U@2026 *(change this immediately)*

---

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL (hosted on Railway)
- **ORM**: Prisma 5
- **Auth**: NextAuth v4
- **Styling**: Tailwind CSS
- **AI**: Anthropic Claude API (AI Suggestions feature)
- **PDF**: @react-pdf/renderer

---

## Accounts to Take Over

| Service | URL | Notes |
|---|---|---|
| Railway (hosting + DB) | railway.app | Project: `angelic-gratitude` |
| GitHub (code repo) | github.com/madelynchin22/happy2u-fashion-app | Main branch = production |
| Anthropic (AI API) | console.anthropic.com | For AI Suggestions feature |

---

## Local Development Setup

### Prerequisites
- Node.js 20+
- Git

### Steps
```bash
# 1. Clone the repo
git clone https://github.com/madelynchin22/happy2u-fashion-app.git
cd happy2u-fashion-app

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env and fill in values (see Environment Variables section below)

# 4. Generate Prisma client
npx prisma generate

# 5. Push schema to local database
npx prisma db push

# 6. Seed the database
npx ts-node prisma/seed.ts

# 7. Start the dev server
npm run dev
```

App runs at http://localhost:3000

---

## Environment Variables

Create a `.env` file with these values:

```env
# Local SQLite database (for development)
DATABASE_URL="file:./dev.db"

# NextAuth — generate with: openssl rand -base64 32
NEXTAUTH_SECRET="your-random-secret"
NEXTAUTH_URL="http://localhost:3000"

# App settings
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_COMPANY_NAME="Happy2U"

# Anthropic API — get from console.anthropic.com
ANTHROPIC_API_KEY="your-anthropic-api-key"
```

---

## Railway (Production) Environment Variables

Set these in Railway → happy2u-fashion-app → Variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (auto-linked) |
| `NEXTAUTH_SECRET` | random 32-char string |
| `NEXTAUTH_URL` | https://happy2u-fashion-app-production.up.railway.app |
| `NEXT_PUBLIC_APP_URL` | https://happy2u-fashion-app-production.up.railway.app |
| `NEXT_PUBLIC_COMPANY_NAME` | Happy2U |
| `ANTHROPIC_API_KEY` | from console.anthropic.com |

---

## Deploying Changes

Every push to `main` triggers an automatic deploy on Railway.

```bash
git add .
git commit -m "description of change"
git push origin main
```

Build takes ~3-5 minutes. Monitor in Railway → Deployments tab.

---

## Database

- **Production**: PostgreSQL on Railway (auto-managed)
- **Local dev**: SQLite (`prisma/dev.db`)
- **Schema**: `prisma/schema.prisma`
- **Seed data**: `prisma/seed.ts` (creates admin user, outlets, manufacturers, competitors)

### Connecting to production DB locally
```bash
# Get DATABASE_PUBLIC_URL from Railway → Postgres → Variables
export DATABASE_URL="postgresql://..."
npx prisma studio  # opens visual DB browser
```

### Running migrations
```bash
npx prisma db push       # push schema changes to DB
npx prisma studio        # visual database browser
```

---

## App Structure

```
app/
  (dashboard)/
    dashboard/           # Main dashboard
    purchase-orders/     # PO management + payment tracking, defect list, outlet receipt
    samples/             # Sample order management
    shipments/           # Shipment tracking
    deliveries/          # Outlet deliveries & QC
    inventory/           # Inventory management
    best-sellers/        # Sales performance
    trend-board/         # Trend tracking
    competitor-monitor/  # Competitor price monitoring
  api/                   # API routes
components/
  layout/                # Sidebar, navigation
lib/
  pdf/                   # PDF generation (PO, packing list)
prisma/
  schema.prisma          # Database schema
  seed.ts                # Initial data seed
```

---

## Key Features
- **Purchase Orders** — create, track, generate PDF
- **Payment Tracking** — 30-day payment terms from ship date
- **Sample Orders** — sample pipeline management
- **Shipments & Deliveries** — QC and outlet delivery tracking
- **Inventory** — stock management
- **Competitor Monitor** — daily auto-crawl at 02:00 MYT
- **AI Suggestions** — collection suggestions via Claude API
- **Best Sellers** — sales data and revenue tracking

---

## Important Notes

1. **Upload folder** (`public/uploads/products/`) is not persisted between Railway deploys — move to S3/Cloudflare R2 if persistent product images are needed
2. **Cron job** runs daily at 02:00 MYT to crawl competitor prices — requires the app to be running
3. **Prisma version** is 5.22.0 — an update to v7+ requires migration steps
4. **SQLite → PostgreSQL** was migrated for Railway deployment — do not revert schema provider to sqlite

---

## Support
- Next.js docs: https://nextjs.org/docs
- Prisma docs: https://www.prisma.io/docs
- Railway docs: https://docs.railway.app
