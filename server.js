require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const pool = require('./db');

const PORT = process.env.PORT || 5000;

// Helper to send JSON responses
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// Format product row from DB to match frontend expectations
function formatProduct(row) {
  let specs = [];
  if (row.specs) {
    try {
      specs = typeof row.specs === 'string' ? JSON.parse(row.specs) : row.specs;
    } catch {
      specs = [];
    }
  }
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    image: row.image,
    price: Number(row.price),
    originalPrice: row.originalPrice ? Number(row.originalPrice) : undefined,
    discount: row.discount || '',
    rating: Number(row.rating) || 0,
    ratingCount: Number(row.ratingCount) || 0,
    reviewsCount: Number(row.reviewsCount) || 0,
    isFlipkartAssured: Boolean(row.isFlipkartAssured),
    specs,
    description: row.description || ''
  };
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // API Endpoints
  // 1. Get all products with filtering, search, category, sort from MySQL
  if (pathname === '/api/products' && method === 'GET') {
    try {
      const { category, search, sort, maxPrice, minRating } = parsedUrl.query;
      let sql = 'SELECT * FROM products WHERE 1=1';
      const params = [];

      if (category && category !== 'All') {
        sql += ' AND LOWER(category) = LOWER(?)';
        params.push(category);
      }

      if (search) {
        const q = `%${search.trim().toLowerCase()}%`;
        sql += ' AND (LOWER(name) LIKE ? OR LOWER(category) LIKE ? OR LOWER(description) LIKE ?)';
        params.push(q, q, q);
      }

      if (maxPrice) {
        sql += ' AND price <= ?';
        params.push(Number(maxPrice));
      }

      if (minRating) {
        sql += ' AND rating >= ?';
        params.push(Number(minRating));
      }

      if (sort === 'price_asc') {
        sql += ' ORDER BY price ASC';
      } else if (sort === 'price_desc') {
        sql += ' ORDER BY price DESC';
      } else if (sort === 'rating') {
        sql += ' ORDER BY rating DESC';
      } else {
        sql += ' ORDER BY created_at DESC';
      }

      const [rows] = await pool.query(sql, params);
      const products = rows.map(formatProduct);
      return sendJSON(res, 200, { success: true, count: products.length, products });
    } catch (err) {
      console.error('MySQL query error in /api/products:', err);
      return sendJSON(res, 500, { success: false, message: 'Database error fetching products' });
    }
  }

  // 2. Get single product by ID from MySQL
  if (pathname.startsWith('/api/products/') && method === 'GET') {
    const id = pathname.replace('/api/products/', '');
    try {
      const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
      if (rows.length > 0) {
        return sendJSON(res, 200, { success: true, product: formatProduct(rows[0]) });
      } else {
        return sendJSON(res, 404, { success: false, message: 'Product not found' });
      }
    } catch (err) {
      console.error('MySQL query error in /api/products/:id:', err);
      return sendJSON(res, 500, { success: false, message: 'Database error fetching product' });
    }
  }

  // 3. Get Categories summary from MySQL
  if (pathname === '/api/categories' && method === 'GET') {
    try {
      const [rows] = await pool.query('SELECT category AS name, COUNT(*) AS count FROM products GROUP BY category');
      return sendJSON(res, 200, { success: true, categories: rows });
    } catch (err) {
      console.error('MySQL query error in /api/categories:', err);
      return sendJSON(res, 500, { success: false, message: 'Database error fetching categories' });
    }
  }

  // 4. Place an order (Checkout) - saved into MySQL
  if (pathname === '/api/orders' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const orderData = JSON.parse(body || '{}');
        const orderId = 'OD' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 900 + 100);
        const createdAt = new Date().toISOString();
        const customer = orderData.customer || { name: 'Valued Customer', phone: '9876543210' };
        const items = orderData.items || [];
        const totalAmount = Number(orderData.totalAmount) || 0;
        const paymentMethod = orderData.paymentMethod || 'UPI / Card / Cash on Delivery';
        const status = 'Confirmed';

        await pool.query(
          `INSERT INTO orders (orderId, createdAt, customerName, customerPhone, items, totalAmount, paymentMethod, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            createdAt,
            customer.name,
            customer.phone,
            JSON.stringify(items),
            totalAmount,
            paymentMethod,
            status
          ]
        );

        const newOrder = {
          orderId,
          createdAt,
          customer,
          items,
          totalAmount,
          paymentMethod,
          status
        };

        return sendJSON(res, 201, { success: true, message: 'Order placed successfully!', order: newOrder });
      } catch (err) {
        console.error('MySQL insert error in /api/orders:', err);
        return sendJSON(res, 400, { success: false, message: 'Invalid order payload or database error' });
      }
    });
    return;
  }

  // 5. List Orders from MySQL
  if (pathname === '/api/orders' && method === 'GET') {
    try {
      const [rows] = await pool.query('SELECT * FROM orders ORDER BY createdAt DESC');
      const orders = rows.map(r => ({
        orderId: r.orderId,
        createdAt: r.createdAt,
        customer: { name: r.customerName, phone: r.customerPhone },
        items: typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []),
        totalAmount: Number(r.totalAmount),
        paymentMethod: r.paymentMethod,
        status: r.status
      }));
      return sendJSON(res, 200, { success: true, orders });
    } catch (err) {
      console.error('MySQL query error in /api/orders:', err);
      return sendJSON(res, 500, { success: false, message: 'Database error fetching orders' });
    }
  }

  // 6. Add product (Admin) - saved into MySQL
  if (pathname === '/api/products' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const productData = JSON.parse(body || '{}');
        const [cntRows] = await pool.query('SELECT COUNT(*) as count FROM products');
        const newId = 'prod-' + (cntRows[0].count + 1);

        const newProduct = {
          id: newId,
          name: productData.name || 'New Item',
          category: productData.category || 'Mobiles',
          image: productData.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
          price: Number(productData.price) || 999,
          originalPrice: Number(productData.originalPrice) || Number(productData.price) * 1.3,
          discount: productData.discount || '20% off',
          rating: 4.5,
          ratingCount: 1,
          reviewsCount: 0,
          isFlipkartAssured: true,
          specs: productData.specs || ['High Quality', 'Standard Warranty'],
          description: productData.description || 'Verified authentic product.'
        };

        await pool.query(
          `INSERT INTO products 
           (id, name, category, image, price, originalPrice, discount, rating, ratingCount, reviewsCount, isFlipkartAssured, specs, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newProduct.id,
            newProduct.name,
            newProduct.category,
            newProduct.image,
            newProduct.price,
            newProduct.originalPrice,
            newProduct.discount,
            newProduct.rating,
            newProduct.ratingCount,
            newProduct.reviewsCount,
            newProduct.isFlipkartAssured ? 1 : 0,
            JSON.stringify(newProduct.specs),
            newProduct.description
          ]
        );

        return sendJSON(res, 201, { success: true, product: newProduct });
      } catch (err) {
        console.error('MySQL insert error in /api/products:', err);
        return sendJSON(res, 400, { success: false, message: 'Invalid product payload or database error' });
      }
    });
    return;
  }

  // Fallback: Serve static client files (index.html, styles, etc.)
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(__dirname, 'public', 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error');
      } else {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*'
        });
        res.end(content);
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Flipkart Clone server connected to MySQL (${process.env.DB_NAME}) running on http://localhost:${PORT}`);
});
