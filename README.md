# Luxury Motors

A premium automotive marketplace with an online storefront, shopping cart, checkout, and an admin dashboard for managing inventory and orders.

## Features

- **Storefront** – Curated catalog of luxury vehicles with filtering-friendly cards, brand logos, and a hero section.
- **Shopping Cart** – Slide-out cart sidebar persisted in `localStorage`, with quantity controls and live totals.
- **Checkout** – Billing form, server-side price validation, automatic 8% tax calculation, and order confirmation.
- **Admin Panel** – Password-protected dashboard with revenue/order statistics, a 6-month revenue chart, order status management, and car inventory CRUD.
- **SQLite Database** – `better-sqlite3` with WAL mode, seeded automatically with sample inventory on first run.

## Tech Stack

- **Backend:** Node.js, Express, better-sqlite3
- **Frontend:** Vanilla HTML/CSS/JavaScript
- **Database:** SQLite (`luxury_motors.db`)

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm

### Installation

```bash
npm install
```

### Run

```bash
npm start
```

The server starts at `http://localhost:3000`.

| Page        | URL                   |
| ----------- | --------------------- |
| Storefront  | `http://localhost:3000` |
| Checkout    | `http://localhost:3000/checkout` |
| Admin panel | `http://localhost:3000/admin` |

### Seeding

On startup, the database is created (if missing) and seeded with 6 sample luxury cars. To reseed from an empty database:

```bash
npm run seed
```

## Configuration

Environment variables (optional):

| Variable         | Default      | Description                          |
| ---------------- | ------------ | ------------------------------------ |
| `PORT`           | `3000`       | Port the server listens on           |
| `DB_PATH`        | `./luxury_motors.db` | Path to the SQLite database  |
| `ADMIN_PASSWORD` | `admin123`   | Password for the admin panel         |

> **Security note:** Change `ADMIN_PASSWORD` via the environment variable before deploying. Do not ship the default password in production.

## Admin Panel

Navigate to `/admin`, enter the admin password, and you can:

- View total revenue, orders, pending orders, and inventory count.
- See revenue by month, orders by status, and top-selling vehicles.
- Filter, view, and update the status of every order.
- Add and remove cars from inventory.

## Project Structure

```
Cars/
├── server.js          # Express app, public API, and admin API
├── db.js              # SQLite schema, connection, and seed data
├── package.json
└── public/
    ├── index.html     # Storefront
    ├── checkout.html  # Checkout flow
    ├── admin.html     # Admin dashboard
    ├── styles.css     # Shared styles
    └── Assets/        # Brand logos and images
```

## API Reference

### Public endpoints

| Method | Endpoint        | Description               |
| ------ | --------------- | ------------------------- |
| GET    | `/api/cars`     | List all cars             |
| GET    | `/api/cars/:id` | Get a single car          |
| POST   | `/api/orders`   | Place an order            |

### Admin endpoints (require `Authorization: Bearer <token>`)

| Method | Endpoint                          | Description            |
| ------ | --------------------------------- | ---------------------- |
| POST   | `/api/admin/login`                | Log in, get a token    |
| POST   | `/api/admin/logout`               | Invalidate the token   |
| GET    | `/api/admin/dashboard`            | Dashboard statistics   |
| GET    | `/api/admin/orders?status=...`    | List orders (filtered) |
| PATCH  | `/api/admin/orders/:id/status`    | Update order status    |
| POST   | `/api/admin/cars`                 | Add a car              |
| DELETE | `/api/admin/cars/:id`             | Delete a car           |

## License

MIT
