const path = require('path');
const crypto = require('crypto');
const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Page routes ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'checkout.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// --- Admin auth (simple in-memory token store) ---
const adminTokens = new Set();

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized. Please log in again.' });
  }
  next();
}

// --- Public API ---

// List cars
app.get('/api/cars', (req, res) => {
  const cars = db.prepare('SELECT * FROM cars ORDER BY id').all();
  res.json(cars);
});

// Get a single car
app.get('/api/cars/:id', (req, res) => {
  const car = db.prepare('SELECT * FROM cars WHERE id = ?').get(req.params.id);
  if (!car) return res.status(404).json({ error: 'Car not found' });
  res.json(car);
});

const TAX_RATE = 0.08;

// Place an order
app.post('/api/orders', (req, res) => {
  const {
    customer_name, email, phone, address, city, state, zip,
    items
  } = req.body || {};

  if (!customer_name || !email || !address || !city || !state || !zip) {
    return res.status(400).json({ error: 'Please fill in all required billing fields.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }

  // Validate items against DB prices (never trust client-side totals)
  const getCar = db.prepare('SELECT * FROM cars WHERE id = ?');
  let subtotal = 0;
  const orderItems = [];
  for (const it of items) {
    const car = getCar.get(it.carId);
    if (!car) return res.status(400).json({ error: `Car #${it.carId} no longer exists.` });
    const quantity = Math.max(1, parseInt(it.quantity, 10) || 1);
    subtotal += car.price * quantity;
    orderItems.push({ car_id: car.id, car_name: car.name, price: car.price, quantity });
  }

  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  const insertOrder = db.prepare(`
    INSERT INTO orders (customer_name, email, phone, address, city, state, zip, subtotal, tax, total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, car_id, car_name, price, quantity)
    VALUES (?, ?, ?, ?, ?)
  `);

  const createOrder = db.transaction(() => {
    const info = insertOrder.run(customer_name, email, phone, address, city, state, zip, subtotal, tax, total);
    const orderId = info.lastInsertRowid;
    for (const item of orderItems) {
      insertItem.run(orderId, item.car_id, item.car_name, item.price, item.quantity);
    }
    return orderId;
  });

  const orderId = createOrder();
  const order = db.prepare(`
    SELECT o.*, json_group_array(json_object(
      'car_id', oi.car_id,
      'car_name', oi.car_name,
      'price', oi.price,
      'quantity', oi.quantity
    )) AS items
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.id = ?
    GROUP BY o.id
  `).get(orderId);
  order.items = JSON.parse(order.items);

  res.status(201).json({ message: 'Order placed successfully', order });
});

// --- Admin API ---

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin password.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  adminTokens.add(token);
  res.json({ token });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  adminTokens.delete(token);
  res.json({ message: 'Logged out' });
});

// Dashboard statistics
app.get('/api/admin/dashboard', requireAdmin, (req, res) => {
  const orderCount = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
  const pendingCount = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status = 'pending'").get().c;
  const revenue = db.prepare("SELECT COALESCE(SUM(total), 0) AS t FROM orders WHERE status != 'cancelled'").get().t;
  const carCount = db.prepare('SELECT COUNT(*) AS c FROM cars').get().c;
  const totalItemsSold = db.prepare("SELECT COALESCE(SUM(quantity), 0) AS t FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status != 'cancelled'").get().t;

  // Revenue by status
  const byStatus = db.prepare('SELECT status, COUNT(*) AS count, COALESCE(SUM(total), 0) AS total FROM orders GROUP BY status').all();

  // Monthly revenue (last 6 months)
  const monthlyRevenue = db.prepare(`
    SELECT strftime('%Y-%m', created_at) AS month, COALESCE(SUM(total), 0) AS total, COUNT(*) AS orders
    FROM orders
    WHERE status != 'cancelled' AND created_at >= date('now', '-6 months')
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month
  `).all();

  // Top selling cars
  const topCars = db.prepare(`
    SELECT oi.car_id, oi.car_name, SUM(oi.quantity) AS sold, SUM(oi.quantity * oi.price) AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status != 'cancelled'
    GROUP BY oi.car_id, oi.car_name
    ORDER BY sold DESC
    LIMIT 5
  `).all();

  res.json({
    stats: {
      totalRevenue: revenue,
      totalOrders: orderCount,
      pendingOrders: pendingCount,
      totalCars: carCount,
      totalItemsSold
    },
    byStatus,
    monthlyRevenue,
    topCars
  });
});

// List orders (optionally filter by status)
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const { status } = req.query;
  let rows;
  if (status && status !== 'all') {
    rows = db.prepare(`
      SELECT o.*, json_group_array(json_object(
        'car_id', oi.car_id,
        'car_name', oi.car_name,
        'price', oi.price,
        'quantity', oi.quantity
      )) AS items
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.status = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC, o.id DESC
    `).all(status);
  } else {
    rows = db.prepare(`
      SELECT o.*, json_group_array(json_object(
        'car_id', oi.car_id,
        'car_name', oi.car_name,
        'price', oi.price,
        'quantity', oi.quantity
      )) AS items
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id
      ORDER BY o.created_at DESC, o.id DESC
    `).all();
  }
  rows.forEach(r => { r.items = JSON.parse(r.items); });
  res.json(rows);
});

// Update order status
app.patch('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  const valid = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  const info = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Order not found' });
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  res.json({ message: 'Order updated', order });
});

// Manage inventory (CRUD for cars)
app.post('/api/admin/cars', requireAdmin, (req, res) => {
  const c = req.body || {};
  if (!c.name || !c.brand || !c.price || !c.image) {
    return res.status(400).json({ error: 'Name, brand, price and image are required.' });
  }
  const info = db.prepare(`
    INSERT INTO cars (name, brand, year, mileage, price, msrp, hp, transmission, fuel, badge, image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    c.name, c.brand, c.year || 2023, c.mileage || 0,
    c.price, c.msrp || c.price, c.hp || 0, c.transmission || 'Automatic', c.fuel || 'Premium',
    c.badge || null, c.image
  );
  const car = db.prepare('SELECT * FROM cars WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ message: 'Car added', car });
});

app.delete('/api/admin/cars/:id', requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM cars WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Car not found' });
  res.json({ message: 'Car deleted' });
});

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Luxury Motors server running at http://localhost:${PORT}`);
  console.log(`Storefront:  http://localhost:${PORT}`);
  console.log(`Checkout:    http://localhost:${PORT}/checkout`);
  console.log(`Admin panel: http://localhost:${PORT}/admin  (password: ${ADMIN_PASSWORD})`);
});
