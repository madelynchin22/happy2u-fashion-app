# Happy2U App — Setup Guide

This guide walks you through installing and running the app step by step.
**You only need to do this once.** After setup, the app starts with one command.

---

## Step 1 — Install Node.js

1. Go to: https://nodejs.org
2. Click the **"LTS"** (green) download button
3. Open the downloaded file and follow the installer
4. When done, open **Terminal** (Mac: search "Terminal" in Spotlight) and type:
   ```
   node --version
   ```
   You should see something like `v20.x.x` ✅

---

## Step 2 — Set up the app

Open Terminal, then copy and paste these commands **one by one**:

```bash
# Go into the app folder
cd /Users/madelynchin/Claude/happy2u-app

# Install all dependencies (takes 2-3 minutes, normal)
npm install

# Copy the environment file
cp .env.example .env

# Create the database and tables
npm run db:push

# Add the first admin user
npx ts-node prisma/seed.ts
```

---

## Step 3 — Start the app

```bash
npm run dev
```

Then open your browser and go to: **http://localhost:3000**

**Login credentials:**
- Email: `admin@happy2u.com`
- Password: `Happy2U@2026`

> ⚠️ Change this password in Settings after first login!

---

## Every day — How to start the app

1. Open Terminal
2. Type:
   ```bash
   cd /Users/madelynchin/Claude/happy2u-app && npm run dev
   ```
3. Open browser → http://localhost:3000

---

## To allow Thailand & other locations to access the app

Right now the app runs only on your computer. To make it accessible from Melaka outlets and Thailand:

### Option A — Vercel (Recommended, Free)

1. Create a free account at https://vercel.com
2. Create a free account at https://supabase.com (for cloud database)
3. In Supabase: create a new project, go to Settings → Database → copy the "Connection string"
4. In your `.env` file, replace `DATABASE_URL` with the Supabase connection string
5. Push code to GitHub, then connect GitHub repo to Vercel
6. Add your `.env` values in Vercel → Project → Settings → Environment Variables
7. Vercel will give you a URL like `happy2u-app.vercel.app` accessible from anywhere

### Option B — Ask a tech friend
Share this folder with someone who knows web deployment for 1 hour. They can set it up on a server.

---

## Adding Outlets (Marking Codes)

1. Go to **Settings** in the app
2. Click "Add Outlet"
3. Enter the outlet name and its **marking code** (must match exactly what you use in packing lists)
   - e.g. Name: `Melaka Main`, Marking: `JN75-H2UHQ`
   - e.g. Name: `Thailand Bangkok`, Marking: `TH-BFZPV-A`
4. Set country (MY or TH) and tick "This is HQ" for your main store

---

## Importing Existing Data

### Manufacturer list (from Excel)
Go to **Manufacturers** → Add Manufacturer → fill in each supplier manually.
(If you have many, contact a developer to do a bulk import from your Excel file.)

### Product list (from Shopify / SiteGiant)
These become your **Sample Order** and **PO** records as you create new orders.
Past data can be entered as **Best Sellers** in the Trends section for AI suggestions.

---

## Updating the Exchange Rate

1. Go to **Settings**
2. Update "RMB → RM Exchange Rate"
3. Click Save Rate
4. All new cost calculations will use the new rate

---

## Generating PDFs

- **Sample Order PDF**: Open a sample order → click "Download PDF"
- **Purchase Order PDF**: Open a PO → click "Download PDF"
- **Packing List PDF**: Open a PO → click "Packing List PDF"
- **Discrepancy Report PDF**: Go to Deliveries → click "Discrepancy PDF" on any flagged delivery

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| App won't start | Make sure you ran `npm install` first |
| "Database not found" | Run `npm run db:push` |
| Can't login | Run `npx ts-node prisma/seed.ts` to recreate admin |
| White screen | Check Terminal for error messages |
| PDF won't download | Make sure you're on Chrome or Edge (not Safari) |

---

## App Structure (what each menu does)

| Menu | What it does |
|------|-------------|
| **Dashboard** | Overview of active orders, shipments, and alerts |
| **Trend Board** | Add/view fashion trends. Click source links to visit original pages |
| **Sample Orders** | Create spec sheets for manufacturers. Track v1 → v2 → v3 |
| **Purchase Orders** | Create POs matching your MS SWEET format. Download PDF |
| **Shipments** | Record container numbers, vessel, ETA. Assign to outlet |
| **Deliveries & QC** | Record received quantities. Flag discrepancies. Download PDF report |
| **Manufacturers** | Supplier contact list and capabilities |
| **Materials Library** | Fabrics, hardware, soles reference library |
| **Settings** | Manage outlet locations, team members, exchange rate |
