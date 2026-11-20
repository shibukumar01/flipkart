const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 5000;
const PRODUCTS_FILE = path.join(__dirname, 'products.json');

// In-memory orders & reviews state
let orders = [];

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

// Read products safely
function getProducts() {
  try {
    const raw = fs.readFileSync(PRODUCTS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read products file', err);
    return [];
  }
}

// Save products if modified
function saveProducts(products) {
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save products file', err);
  }
}

const server = http.createServer((req, res) => {
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
  // 1. Get all products with filtering, search, category, sort
  if (pathname === '/api/products' && method === 'GET') {
    let products = getProducts();
    const { category, search, sort, maxPrice, minRating } = parsedUrl.query;

    if (category && category !== 'All') {
      products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase().trim();
      products = products.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }

    if (maxPrice) {
      products = products.filter(p => p.price <= Number(maxPrice));
    }

    if (minRating) {
      products = products.filter(p => p.rating >= Number(minRating));
    }

    if (sort === 'price_asc') {
      products.sort((a, b) => a.price - b.price);
    } else if (sort === 'price_desc') {
      products.sort((a, b) => b.price - a.price);
    } else if (sort === 'rating') {
      products.sort((a, b) => b.rating - a.rating);
    }

    return sendJSON(res, 200, { success: true, count: products.length, products });
  }

  // 2. Get single product by ID
  if (pathname.startsWith('/api/products/') && method === 'GET') {
    const id = pathname.replace('/api/products/', '');
    const products = getProducts();
    const product = products.find(p => p.id === id);

    if (product) {
      return sendJSON(res, 200, { success: true, product });
    } else {
      return sendJSON(res, 404, { success: false, message: 'Product not found' });
    }
  }

  // 3. Get Categories summary
  if (pathname === '/api/categories' && method === 'GET') {
    const products = getProducts();
    const categoryMap = {};
    products.forEach(p => {
      categoryMap[p.category] = (categoryMap[p.category] || 0) + 1;
    });
    const categories = Object.keys(categoryMap).map(name => ({
      name,
      count: categoryMap[name]
    }));
    return sendJSON(res, 200, { success: true, categories });
  }

  // 4. Place an order (Checkout)
  if (pathname === '/api/orders' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const orderData = JSON.parse(body || '{}');
        const orderId = 'OD' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 900 + 100);
        const newOrder = {
          orderId,
          createdAt: new Date().toISOString(),
          customer: orderData.customer || { name: 'Valued Customer', phone: '9876543210' },
          items: orderData.items || [],
          totalAmount: orderData.totalAmount || 0,
          paymentMethod: orderData.paymentMethod || 'UPI / Card / Cash on Delivery',
          status: 'Confirmed'
        };
        orders.unshift(newOrder);
        return sendJSON(res, 201, { success: true, message: 'Order placed successfully!', order: newOrder });
      } catch (err) {
        return sendJSON(res, 400, { success: false, message: 'Invalid order payload' });
      }
    });
    return;
  }

  // 5. List Orders
  if (pathname === '/api/orders' && method === 'GET') {
    return sendJSON(res, 200, { success: true, orders });
  }

  // 6. Add product (Admin mock)
  if (pathname === '/api/products' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const productData = JSON.parse(body || '{}');
        const products = getProducts();
        const newProduct = {
          id: 'prod-' + (products.length + 1),
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
        products.push(newProduct);
        saveProducts(products);
        return sendJSON(res, 201, { success: true, product: newProduct });
      } catch (err) {
        return sendJSON(res, 400, { success: false, message: 'Invalid product payload' });
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
  console.log(`Flipkart Clone server is running smoothly on http://localhost:${PORT}`);
});
