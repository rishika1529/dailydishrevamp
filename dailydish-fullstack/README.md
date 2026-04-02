# 🍽️ Daily Dish — Full-Stack

**Fresh Deals. Zero Waste.**  
A marketplace connecting buyers to near-expiry surplus food from local shops, at deep discounts.

---

## ✅ What's built

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Real-time | Socket.IO |
| File uploads | Multer |
| Frontend | HTML + Tailwind CSS (unchanged UI) |

### Pages
| File | Who sees it |
|---|---|
| `index.html` | Everyone — landing page with live deals |
| `login.html` | Everyone |
| `signup.html` | Everyone (video intro + role selection) |
| `buyer_dashboard.html` | Buyers — browse & reserve deals |
| `seller_dashboard.html` | Sellers — post deals, see stats |
| `purchase_history.html` | Buyers |
| `savings.html` | Buyers |
| `reviews.html` | Buyers — post reviews |
| `seller_selling_history.html` | Sellers — incoming orders, mark picked up |
| `seller_reviews.html` | Sellers — see their reviews |
| `shops_map.html` | Everyone — OpenStreetMap of shops |

### API Endpoints
```
POST  /api/auth/signup
POST  /api/auth/login
GET   /api/auth/me

GET   /api/deals              (public)
GET   /api/deals/my           (seller only)
GET   /api/deals/:id          (public)
POST  /api/deals              (seller, multipart/form-data)
PATCH /api/deals/:id          (seller)
DELETE/api/deals/:id          (seller)

POST  /api/orders             (buyer — reserve deal)
GET   /api/orders/my          (buyer)
GET   /api/orders/seller      (seller)
PATCH /api/orders/:id/status  (buyer cancel / seller mark picked_up)
GET   /api/orders/stats       (buyer savings summary)

GET   /api/reviews            (public)
POST  /api/reviews            (buyer)
DELETE/api/reviews/:id        (buyer, own review)
```

---

## 🚀 Setup Instructions

### 1. Install dependencies
```bash
cd dailydish-fullstack
npm install
```

### 2. Set up MongoDB

**Option A — Local MongoDB (easiest for dev)**
- Download from https://www.mongodb.com/try/download/community
- Install and start: `mongod --dbpath /data/db`
- URI: `mongodb://localhost:27017/dailydish`

**Option B — MongoDB Atlas (free cloud, recommended for deployment)**
1. Go to https://www.mongodb.com/atlas
2. Create a free cluster
3. Get connection string — looks like:
   `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/dailydish`

### 3. Configure `.env`
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/dailydish   # or your Atlas URI
JWT_SECRET=replace_this_with_a_long_random_string
JWT_EXPIRES_IN=7d
SESSION_SECRET=another_random_string
```

### 4. Copy your video file
Place your intro animation video (`WhatsApp Video 2025-10-26 at 16.08.29.mp4`) 
into the `public/` folder.

### 5. Run
```bash
npm run dev     # development (auto-restarts on changes)
# or
npm start       # production
```

Then open **http://localhost:5000** in your browser.

---

## 🔄 Changes from your original

| What changed | Why |
|---|---|
| `localStorage` removed from all pages | Replaced with real API calls |
| `app.js` / `main.js` / `utils.js` removed | Replaced by `api.js` (shared client helper) |
| `main.js` (Express) → `backend/server.js` | Proper server entry point |
| Auth is real JWT | Signup/login now persists across sessions |
| Deals stored in MongoDB | Multi-user, real-time, persistent |
| Signup page now shows role selector | Buyer vs Seller split at registration |
| `role_selection.html` removed | Role chosen during signup |
| Socket.IO client added | Live deal notifications in buyer dashboard |
| Leaflet map in shops_map.html | Real interactive map (OpenStreetMap, free) |
| Image uploads saved to `public/uploads/` | Sellers can upload product photos |

---

## 📁 Project Structure

```
dailydish-fullstack/
├── backend/
│   ├── server.js            ← Express entry point
│   ├── middleware/
│   │   └── auth.js          ← JWT protect + requireRole
│   ├── models/
│   │   ├── User.js
│   │   ├── Deal.js
│   │   ├── Order.js
│   │   └── Review.js
│   └── routes/
│       ├── auth.js
│       ├── deals.js
│       ├── orders.js
│       └── reviews.js
├── public/                  ← All HTML pages + static assets
│   ├── api.js               ← Shared frontend API helper
│   ├── index.html
│   ├── login.html
│   ├── signup.html
│   ├── buyer_dashboard.html
│   ├── seller_dashboard.html
│   ├── purchase_history.html
│   ├── savings.html
│   ├── reviews.html
│   ├── seller_selling_history.html
│   ├── seller_reviews.html
│   ├── shops_map.html
│   ├── assets/              ← Your banner images
│   └── uploads/             ← Deal images (auto-created)
├── .env
└── package.json
```

---

## 🔐 Test Credentials
After running the server, sign up yourself via the UI.  
No seed credentials are pre-loaded — registration is live.
