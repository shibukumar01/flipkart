const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function initDB() {
  try {
    console.log('Connecting to MySQL database...');

    // 1. Create products table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        image VARCHAR(500),
        price DECIMAL(10, 2) NOT NULL,
        originalPrice DECIMAL(10, 2),
        discount VARCHAR(50),
        rating DECIMAL(3, 2) DEFAULT 0.0,
        ratingCount INT DEFAULT 0,
        reviewsCount INT DEFAULT 0,
        isFlipkartAssured BOOLEAN DEFAULT TRUE,
        specs JSON,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✔ Products table verified/created.');

    // 2. Create orders table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        orderId VARCHAR(50) PRIMARY KEY,
        createdAt VARCHAR(50) NOT NULL,
        customerName VARCHAR(100),
        customerPhone VARCHAR(20),
        items JSON,
        totalAmount DECIMAL(10, 2) NOT NULL,
        paymentMethod VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Confirmed'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✔ Orders table verified/created.');

    // 3. Seed products if empty
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM products');
    if (rows[0].count === 0) {
      console.log('Importing initial products from products.json...');
      const productsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'products.json'), 'utf8'));

      for (const p of productsData) {
        await pool.query(
          `INSERT INTO products 
           (id, name, category, image, price, originalPrice, discount, rating, ratingCount, reviewsCount, isFlipkartAssured, specs, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.id,
            p.name,
            p.category,
            p.image,
            p.price,
            p.originalPrice || null,
            p.discount || '',
            p.rating || 0,
            p.ratingCount || 0,
            p.reviewsCount || 0,
            p.isFlipkartAssured ? 1 : 0,
            JSON.stringify(p.specs || []),
            p.description || ''
          ]
        );
      }
      console.log(`✔ Successfully inserted ${productsData.length} products.`);
    } else {
      console.log(`ℹ Products table already has ${rows[0].count} items.`);
    }

    console.log('Database initialization completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Database initialization error:', err);
    process.exit(1);
  }
}

initDB();
