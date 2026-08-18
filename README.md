# Kavach Setu: Secure API Gateway & Analytics Portal

Kavach Setu is a production-ready, modular Developer API Gateway and Metrics Dashboard. It provides a secure mechanism for users to generate API keys, monitors usage against tier-based rate limits, and offers detailed time-series metrics. It also includes an administrative portal for user management and configuration.

## 🚀 Features

- **2-Step Registration & Email Verification:** Ephemeral OTP email verification powered by EmailJS, stored securely in MongoDB with a 10-minute TTL.
- **API Key Management:** Users can generate, view, and revoke their API keys. Key secrets are securely hashed (SHA-256) before database storage.
- **Dynamic Rate Limiting:** Sliding-window rate limiter powered by Redis/MongoDB with caching. Limits adapt dynamically based on user Tiers (`FREE`, `PRO`).
- **Time-Series Analytics:** Comprehensive 5-hour rolling metrics tracking API key usage, successful requests, and rate-limit violations.
- **Admin Portal:** Full administrative controls to ban/unban users, alter roles, assign tiers, and modify tier configurations on the fly.
- **Strong Security:** Passwords hashed with bcrypt, strict TypeScript types, centralized operational error handling, and robust middleware guards.

## 🛠 Tech Stack

- **Backend:** Node.js, Express.js, TypeScript
- **Relational DB:** PostgreSQL (via Prisma ORM) for Users, API Keys, and Tier Configurations
- **NoSQL DB:** MongoDB (via Mongoose) for high-volume Request Logs and Ephemeral OTPs
- **Security:** JWT Authentication, Bcrypt password hashing, EmailJS REST API
- **Frontend:** Vanilla HTML, CSS (Tailwind via CDN), JavaScript (Glassmorphism UI)

## 📦 Prerequisites

Ensure you have the following installed before setting up the project:
- [Node.js](https://nodejs.org/en/) (v18 or higher)
- [PostgreSQL](https://www.postgresql.org/) (Running instance or Supabase/Neon)
- [MongoDB](https://www.mongodb.com/) (Running instance or MongoDB Atlas)
- An [EmailJS](https://www.emailjs.com/) account for OTP dispatch

## ⚙️ Environment Variables

Create a `.env` file in the root directory by copying the provided example:

```bash
cp .env.example .env
```

Ensure the following variables are correctly populated:

```env
# Server
PORT=3000
JWT_SECRET=your_super_secret_jwt_key_here

# PostgreSQL Database (Prisma)
DATABASE_URL="postgresql://user:password@localhost:5432/kavach-setu?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/kavach-setu?schema=public"

# MongoDB Database (Mongoose)
MONGO_URI="mongodb://localhost:27017/kavach-setu"

# EmailJS OTP Configuration
EMAILJS_SERVICE_ID=your_service_id
EMAILJS_TEMPLATE_ID=your_template_id
EMAILJS_PUBLIC_KEY=your_public_key
EMAILJS_PRIVATE_KEY=your_private_key
```

*Note: You must enable "Allow EmailJS API for non-browser applications" in your EmailJS Security settings for the backend dispatch to work.*

## 🌐 Deploy to Render (Cloud)

Kavach Setu is fully configured for seamless deployment on **Render**:

### Option 1: Automatic Blueprint (Recommended)
1. Go to [Render Dashboard](https://dashboard.render.com/) > **New +** > **Blueprint**.
2. Connect your GitHub repository (`Kavach-Setu`).
3. Render will read `render.yaml` and configure everything automatically.
4. Fill in your environment variables (`DATABASE_URL`, `MONGO_URI`, `EMAILJS_*`, etc.) and click **Apply**.

### Option 2: Manual Web Service
1. **Create Web Service** on Render connected to your repository.
2. **Runtime:** `Node`
3. **Build Command:** `npm install && npm run build && npx prisma db push`
4. **Start Command:** `npm start`
5. **Environment Variables:** Add all variables from `.env.example` in the Render Environment tab.

---

## 🚀 Local Installation & Setup

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Generate the Prisma Client and migrate the database:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **(Optional) Seed the database with default Tiers and Admin user:**
   ```bash
   npx tsx prisma/seed.ts
   ```

4. **Build the application:**
   ```bash
   npm run build
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Access the application:**
   - Client Portal: `http://localhost:3000`
   - API endpoints prefix: `http://localhost:3000/api/`

## 📂 Project Structure

```text
src/
├── config/             # DB instances & typed env variables
├── controllers/        # Business logic & request handling
├── middlewares/        # Auth, rate-limiting, and error handlers
├── models/             # Mongoose schemas (Logs, OTPs)
├── routes/             # Express route mappings
├── services/           # External API integrations (EmailJS)
├── types/              # Centralized TypeScript definitions
└── utils/              # Reusable helpers (Errors, Handlers, Guards)
```
