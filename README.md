# Kavach Setu v2.0: Developer API Reverse Proxy & Gatekeeper Portal

> 🚀 **Live Demo:** [https://kavach-setu.onrender.com](https://kavach-setu.onrender.com)

Kavach Setu is a production-grade, modular **API Reverse Proxy, Rate-Limiting Gatekeeper, and Telemetry Portal**. It allows developers to shield their backend APIs by defining custom rate limits, routing traffic through unique proxy links, inspecting live request telemetry, and running real-time traffic stress tests.

---

## 🚀 Key Features

- **Dynamic API Reverse Proxy:** Forward incoming requests (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`) transparently to user-defined Target API URLs while shielding backend origins.
- **Sliding-Window Rate Limiting:** Enforces granular, per-endpoint rate limits calculated against a sliding 60-second window in MongoDB. Returns `429 Too Many Requests` with standard `X-RateLimit-*` and `Retry-After` headers upon breach.
- **SSRF & Security Defense:** Built-in Server-Side Request Forgery (SSRF) filters blocking local loopback (`localhost`, `127.0.0.1`), internal private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and cloud metadata services (`169.254.169.254`).
- **Interactive cURL Playground:** Test reverse proxy routes directly from the dashboard to inspect forwarded payloads, status codes, latency, and injected rate-limiting headers.
- **Real-Time Traffic Stress Engine:** Simulate burst traffic against your proxy endpoints with live waterfall telemetry to visually verify rate-limiting thresholds.
- **Time-Series Telemetry & Analytics:** 5-hour rolling telemetry charts and historical request logs (Method, Status, Latency, Timestamp) for every route.
- **Admin Management Portal:** Manage user access, modify tier rate limits and endpoint allowances, change roles, and ban abusive accounts with instant proxy deactivation.
- **4-Theme Glassmorphism UI:** WCAG AA compliant design system supporting *Liquid Dark*, *Liquid Light*, *Solar Dark*, and *Solar Light*.

---

## 🛠 Tech Stack

- **Backend Runtime:** Node.js 20.x, Express.js, TypeScript (Strict Mode)
- **Relational Database:** PostgreSQL (via Prisma ORM) for Users, Proxy Endpoints, and Tier Configurations
- **NoSQL Database:** MongoDB (via Mongoose) for high-throughput sliding-window Request Logs & OTP verification
- **Security:** Bcrypt password hashing, JWT Authentication, SSRF Protection, In-Memory Auth Rate Limiting
- **Frontend:** Vanilla JavaScript, CSS Variables (4 Theme Engine), TailwindCSS, Chart.js

---

## 📦 Prerequisites

- [Node.js](https://nodejs.org/en/) (v18.x or v20.x)
- [PostgreSQL](https://www.postgresql.org/) (Local, Supabase, or Neon)
- [MongoDB](https://www.mongodb.com/) (Local or MongoDB Atlas)
- (Optional) [EmailJS](https://www.emailjs.com/) account for OTP email delivery

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory by copying the provided template:

```bash
cp .env.example .env
```

Populate the required values:

```env
# Server Configuration
PORT=3000
JWT_SECRET=your_super_secret_jwt_key_here

# PostgreSQL Database (Prisma)
DATABASE_URL="postgresql://user:password@localhost:5432/kavach-setu?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/kavach-setu?schema=public"

# MongoDB Database (Mongoose)
MONGO_URI="mongodb://localhost:27017/kavach-setu"

# EmailJS OTP Configuration (Optional for local testing - OTP logs to terminal)
EMAILJS_SERVICE_ID=your_service_id
EMAILJS_TEMPLATE_ID=your_template_id
EMAILJS_PUBLIC_KEY=your_public_key
EMAILJS_PRIVATE_KEY=your_private_key
```

---

## 🌐 Live Deployment

Access the live production instance of Kavach Setu:

🔗 **[https://kavach-setu.onrender.com](https://kavach-setu.onrender.com)**

---

## 🚀 Local Installation & Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Sync PostgreSQL Schema:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **(Optional) Seed Default Tiers and Admin User:**
   ```bash
   npm run db:seed
   ```
   *Default Admin credentials:* `admin@kavachsetu.local` / `Admin@123456`

4. **Start Development Server:**
   ```bash
   npm run dev
   ```

5. **Open Portal:**
   - Web Portal: `http://localhost:3000`
   - Proxy Route Format: `http://localhost:3000/proxy/:slug/*`

---

## 📂 Project Structure

```text
.
├── prisma/
│   ├── schema.prisma       # PostgreSQL Prisma schema (Users, ProxyEndpoints, TierConfig)
│   └── seed.ts             # Default Tiers and Admin user seeder
├── public/
│   ├── assets/             # Brand logos & assets
│   ├── admin.html          # Administrative management portal
│   ├── admin.js            # Admin portal frontend script
│   ├── app.js              # Dashboard & telemetry frontend logic
│   ├── dashboard.html      # Reverse proxy dashboard & stress tester
│   ├── index.html          # Login / Register portal
│   ├── logo.png            # Logo icon
│   └── style.css           # 4-Theme Glassmorphism UI tokens
├── src/
│   ├── config/             # DB clients (PostgreSQL, MongoDB) & typed env
│   ├── controllers/        # Express request controllers (Proxy, Endpoints, Auth, Admin)
│   ├── middlewares/        # JWT auth, SSRF guards, Admin guards, Auth rate limiters
│   ├── models/             # Mongoose schemas (RequestLog, OtpVerification)
│   ├── routes/             # API & Proxy route definitions
│   ├── services/           # External service integrations (EmailJS)
│   ├── types/              # Centralized TypeScript types
│   ├── utils/              # SSRF validator, error handlers, response wrappers
│   └── index.ts            # Server entry point & security headers
├── package.json            # Version 2.0.0 dependencies & scripts
└── tsconfig.json           # TypeScript configuration
```
