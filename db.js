const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'luxury_motors.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS cars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    year INTEGER NOT NULL,
    mileage INTEGER NOT NULL,
    price REAL NOT NULL,
    msrp REAL NOT NULL,
    hp INTEGER NOT NULL,
    transmission TEXT NOT NULL,
    fuel TEXT NOT NULL,
    badge TEXT,
    image TEXT NOT NULL,
    featured INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip TEXT NOT NULL,
    subtotal REAL NOT NULL,
    tax REAL NOT NULL,
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    car_id INTEGER NOT NULL,
    car_name TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );
`);

function seed() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM cars').get().c;
  if (count > 0) return false;

  const insert = db.prepare(`
    INSERT INTO cars (name, brand, year, mileage, price, msrp, hp, transmission, fuel, badge, image)
    VALUES (@name, @brand, @year, @mileage, @price, @msrp, @hp, @transmission, @fuel, @badge, @image)
  `);

  const cars = [
    {
      name: 'Mercedes-Benz S-Class', brand: 'Mercedes-Benz', year: 2023, mileage: 5200,
      price: 129900, msrp: 134300, hp: 496, transmission: 'Automatic', fuel: 'Hybrid',
      badge: 'New Arrival',
      image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80'
    },
    {
      name: 'BMW 7 Series', brand: 'BMW', year: 2023, mileage: 3700,
      price: 112500, msrp: 118900, hp: 523, transmission: 'Automatic', fuel: 'Premium',
      badge: 'Limited',
      image: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80'
    },
    {
      name: 'Audi A8 L', brand: 'Audi', year: 2023, mileage: 2800,
      price: 98750, msrp: 104200, hp: 453, transmission: 'Automatic', fuel: 'Premium',
      badge: null,
      image: 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2025&q=80'
    },
    {
      name: 'Porsche Taycan Turbo S', brand: 'Porsche', year: 2023, mileage: 1200,
      price: 189900, msrp: 195000, hp: 750, transmission: 'Automatic', fuel: 'Electric',
      badge: 'Electric',
      image: 'https://images.unsplash.com/photo-1555626906-fcf10d6851b4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80'
    },
    {
      name: 'Range Rover Autobiography', brand: 'Land Rover', year: 2023, mileage: 6500,
      price: 145500, msrp: 152000, hp: 518, transmission: 'Automatic', fuel: 'Premium',
      badge: 'Certified',
      image: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80'
    },
    {
      name: 'Lexus LS 500h', brand: 'Lexus', year: 2023, mileage: 4100,
      price: 89900, msrp: 94200, hp: 354, transmission: 'Automatic', fuel: 'Hybrid',
      badge: null,
      image: 'https://images.unsplash.com/photo-1616788494707-ec28f08d05a1?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1887&q=80'
    }
  ];

  const insertAll = db.transaction(() => {
    for (const car of cars) insert.run(car);
  });
  insertAll();
  return true;
}

seed();

module.exports = db;
