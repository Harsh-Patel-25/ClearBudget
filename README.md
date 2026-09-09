# 💎 ClearBudget - Smart Financial & Expense Tracker

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.19.2-lightgrey.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen.svg)](https://www.mongodb.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-blueviolet.svg)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![Netlify](https://img.shields.io/badge/Deploy-Netlify-00C7B7.svg)](https://www.netlify.com/)

**ClearBudget** is a modern, responsive, full-stack personal finance app and Progressive Web App (PWA) designed to give users complete clarity over their daily expenses, income, split bills, and financial insights.

Built with a fast Node.js/Express backend, robust JWT authentication, MongoDB Atlas storage (with an automatic zero-config in-memory fallback engine), and a sleek dark-themed UI.

---

## ✨ Features Overview

- 💳 **Transaction Management**: Add, view, filter, edit, and delete income and expense records with category tags, payment methods, dates, and custom notes.
- 📊 **Spending Insights & Analytics**: Interactive visual charts and category breakdowns to analyze your cash flow and spending habits.
- 👥 **Friend Split & Debt Tracker**: Track shared expenses with friends, split bills, keep log of money borrowed or lent, and easily record settlements.
- 🔒 **Secure Authentication**: User sign up and login with JWT tokens, password hashing via `bcryptjs`, and role-based permissions (User / Admin).
- 👑 **Admin Console**: Built-in Administrator dashboard (`/admin.html`) to manage registered users, monitor system metrics, and oversee platform activity.
- ⚡ **Dual Engine Storage (Hybrid)**: Automatically connects to MongoDB Atlas when `MONGODB_URI` is provided, with a fast, resilient In-Memory Fallback if MongoDB is disconnected or unconfigured.
- 📱 **Progressive Web App (PWA)**: Includes Service Worker (`sw.js`), Web App Manifest (`manifest.json`), and offline accessibility for installation on desktop and mobile devices.
- 🚀 **Serverless Ready**: Pre-configured for serverless deployment on **Netlify Functions** (`serverless-http`), as well as traditional Node.js servers or container environments.
- 🧰 **Financial Utilities**: Savings targets, budget goals, data import/export options, and financial tools (`extra.html`).

---

## 🛠️ Tech Stack

### **Frontend**
- **HTML5 & Vanilla CSS3**: Custom dark glassmorphic design system with vibrant cyan/purple neon accents.
- **Vanilla JavaScript (ES6+)**: Dynamic UI rendering, client-side routing, modular toast alerts, and API handlers.
- **Progressive Web App (PWA)**: Service Worker caching & Web App Manifest.

### **Backend & Database**
- **Node.js & Express.js**: RESTful API server.
- **Authentication**: JSON Web Tokens (`jsonwebtoken`) & `bcryptjs` password encryption.
- **Database**: MongoDB Atlas via `Mongoose` OR In-Memory Data Store fallback.
- **Serverless**: `serverless-http` for Netlify Functions integration.

---

## 📁 Project Architecture

```text
ClearBudget/
├── index.html            # Main Dashboard & Financial Overview
├── add.html              # Add New Income / Expense Form
├── transaction.html      # Complete Transaction History & Filters
├── friend.html           # Friend Debt & Split Bill Tracker
├── insight.html          # Financial Analytics & Spending Charts
├── extra.html            # Extra Financial Utilities & Tools
├── login.html            # User Login & Registration Interface
├── admin.html            # Admin Management Portal
├── done.html             # Transaction Confirmation Screen
├── server.js             # Express REST API Server & Fallback Database Engine
├── manifest.json         # PWA Application Manifest
├── sw.js                 # Service Worker for Offline Functionality
├── package.json          # Node.js Dependencies & NPM Scripts
├── .env.example          # Environment Variables Template
├── netlify.toml          # Netlify Deployment Configuration
├── _redirects            # Netlify SPA & API Rewrite Rules
├── css/                  # Styling & UI Theme Stylesheets
├── js/
│   ├── api.js            # Frontend API Service & HTTP Client
│   ├── auth.js           # JWT Authentication & Route Guards
│   └── toast.js          # Interactive Notification Component
├── models/
│   ├── User.js           # Mongoose User Schema
│   ├── Transaction.js    # Mongoose Transaction Schema
│   └── Friend.js         # Mongoose Friend / Split Schema
└── netlify/
    └── functions/
        └── api.js        # Netlify Serverless Function Wrapper
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) (bundled with Node.js)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account *(Optional — falls back to local memory store)*

---

### 1️⃣ Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Harsh-Patel-25/ClearBudget.git
cd ClearBudget
npm install
```

---

### 2️⃣ Environment Configuration

Create a `.env` file in the root directory (you can copy `.env.example`):

```bash
cp .env.example .env
```

Edit your `.env` file:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/clearbudget?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_here
```

> 💡 **Note**: If `MONGODB_URI` is left empty or invalid, **ClearBudget** automatically operates using its built-in fast In-Memory Storage Engine so you can start testing instantly without configuring a database!

---

### 3️⃣ Running the Application

#### Development Mode (Auto-reload):
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

Open your browser and navigate to:
```text
http://localhost:5000
```

---

## 🔐 Default Admin Account

When starting the application for the first time, a master administrator account is automatically seeded:

- **Email**: `admin@clearbudget.com`
- **Password**: `admin123`

You can log in with these credentials to access the **Admin Console** at `http://localhost:5000/admin.html`.

---

## 📡 REST API Documentation

### **Authentication**
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Authenticate user & get JWT token
- `GET /api/auth/me` - Get current authenticated user details

### **Transactions**
- `GET /api/transactions` - Fetch user transactions (with optional limit & filtering)
- `POST /api/transactions` - Add new transaction (Income / Expense)
- `PUT /api/transactions/:id` - Update existing transaction
- `DELETE /api/transactions/:id` - Delete transaction

### **Friends & Split Bills**
- `GET /api/friends` - List all friend records & debt statuses
- `POST /api/friends` - Add friend / log split expense or loan
- `PUT /api/friends/:id` - Update settlement / debt details
- `DELETE /api/friends/:id` - Remove friend record

### **Admin Endpoints** (Requires Admin Token)
- `GET /api/admin/stats` - Platform total users, transactions, and overview
- `GET /api/admin/users` - Fetch all registered platform users
- `DELETE /api/admin/users/:id` - Remove a user account

---

## 🌐 Netlify Serverless Deployment

ClearBudget is configured for instant serverless deployment on Netlify out of the box:

1. Push your code to your GitHub repository.
2. Connect your repository to [Netlify](https://www.netlify.com/).
3. Set Environment Variables in Netlify Dashboard:
   - `MONGODB_URI`
   - `JWT_SECRET`
4. Netlify will detect `netlify.toml` and automatically route requests to `netlify/functions/api.js`.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📬 Contact & Author

Created with ❤️ by **Harsh Patel**

- **GitHub**: [@Harsh-Patel-25](https://github.com/Harsh-Patel-25)
- **Repository**: [ClearBudget Repo](https://github.com/Harsh-Patel-25/ClearBudget)
- **Email**: [hpatel25177@gmail.com](mailto:hpatel25177@gmail.com)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
