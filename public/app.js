const { useState, useEffect, useMemo } = React;

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [tempSearch, setTempSearch] = useState('');
  const [sortOption, setSortOption] = useState('popular');
  const [maxPrice, setMaxPrice] = useState(100000);
  const [minRating, setMinRating] = useState(0);

  // Modals & Popups
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // Categories definition with icons
  const categoriesList = [
    { name: 'All', icon: 'fa-layer-group' },
    { name: 'Mobiles', icon: 'fa-mobile-screen-button' },
    { name: 'Electronics', icon: 'fa-laptop' },
    { name: 'Fashion', icon: 'fa-shirt' },
    { name: 'Appliances', icon: 'fa-blender-phone' },
    { name: 'Home & Furniture', icon: 'fa-couch' }
  ];

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Fetch products from Node.js API
  const fetchProducts = async () => {
    setLoading(true);
    try {
      let query = `?sort=${sortOption}&maxPrice=${maxPrice}`;
      if (category !== 'All') query += `&category=${encodeURIComponent(category)}`;
      if (searchQuery) query += `&search=${encodeURIComponent(searchQuery)}`;
      if (minRating > 0) query += `&minRating=${minRating}`;

      const res = await fetch(`/api/products${query}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products);
      }
    } catch (err) {
      console.error('Failed to load products', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [category, searchQuery, sortOption, maxPrice, minRating]);

  // Cart operations
  const addToCart = (product, e) => {
    if (e) e.stopPropagation();
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      } else {
        return [...prev, { ...product, qty: 1 }];
      }
    });
    showToast(`Added "${product.name.slice(0, 24)}..." to cart!`);
  };

  const updateCartQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
    showToast('Item removed from cart');
  };

  // Calculations
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  }, [cart]);

  const cartOriginalTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.originalPrice * item.qty), 0);
  }, [cart]);

  const totalCartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }, [cart]);

  // Order placement
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const orderPayload = {
      customer: {
        name: formData.get('fullname'),
        phone: formData.get('phone'),
        address: formData.get('address'),
        pincode: formData.get('pincode')
      },
      items: cart,
      totalAmount: cartTotal,
      paymentMethod: formData.get('paymentMethod')
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      const data = await res.json();
      if (data.success) {
        setCart([]);
        setIsCheckoutOpen(false);
        setIsCartOpen(false);
        setOrderSuccess(data.order);
      }
    } catch (err) {
      alert('Order submission error');
    }
  };

  return (
    <div>
      {/* Header */}
      <header className="fk-header">
        <div className="fk-header-content">
          <div className="fk-logo-section" onClick={() => { setCategory('All'); setSearchQuery(''); setTempSearch(''); }}>
            <span className="fk-brand-title">Flipkart</span>
            <div className="fk-explore-plus">
              Explore <span>Plus</span>
              <i className="fa-solid fa-plus" style={{ color: '#ffe500', fontSize: '9px', marginLeft: '2px' }}></i>
            </div>
          </div>

          <form className="fk-search-container" onSubmit={(e) => { e.preventDefault(); setSearchQuery(tempSearch); }}>
            <input
              type="text"
              className="fk-search-input"
              placeholder="Search for Products, Brands and More"
              value={tempSearch}
              onChange={(e) => setTempSearch(e.target.value)}
            />
            <button type="submit" className="fk-search-btn">
              <i className="fa-solid fa-magnifying-glass"></i>
            </button>
          </form>

          <div className="fk-nav-actions">
            <button className="fk-login-btn" onClick={() => showToast('Login feature: demo guest mode is active!')}>
              Login
            </button>
            <div className="fk-cart-btn" onClick={() => setIsCartOpen(true)}>
              <i className="fa-solid fa-cart-shopping" style={{ fontSize: '18px' }}></i>
              {totalCartCount > 0 && <span className="fk-cart-badge">{totalCartCount}</span>}
              <span>Cart</span>
            </div>
          </div>
        </div>
      </header>

      {/* Categories Bar */}
      <nav className="fk-categories-bar">
        <div className="fk-categories-container">
          {categoriesList.map(cat => (
            <div
              key={cat.name}
              className={`fk-cat-item ${category === cat.name ? 'active' : ''}`}
              onClick={() => setCategory(cat.name)}
            >
              <i className={`fa-solid ${cat.icon} fk-cat-icon`}></i>
              <span className="fk-cat-title">{cat.name}</span>
            </div>
          ))}
        </div>
      </nav>

      {/* Hero Banner */}
      <section className="fk-hero-banner">
        <div className="fk-banner-card">
          <div>
            <div className="fk-banner-tag">Big Savings Festival</div>
            <div className="fk-banner-title">Mega Electronics & Mobiles Sale</div>
            <div className="fk-banner-sub">Up to 70% Off + Extra Bank Discounts & Instant Replacement</div>
            <button className="fk-banner-btn" onClick={() => setCategory('Electronics')}>Shop Deals Now</button>
          </div>
          <i className="fa-solid fa-bolt" style={{ fontSize: '90px', opacity: 0.25 }}></i>
        </div>
      </section>

      {/* Main Container */}
      <main className="fk-main-container">
        {/* Sidebar Filters */}
        <aside className="fk-sidebar">
          <div className="fk-filter-heading">
            <span>Filters</span>
            <button className="fk-filter-reset" onClick={() => {
              setMaxPrice(100000);
              setMinRating(0);
              setCategory('All');
              setSearchQuery('');
              setTempSearch('');
            }}>CLEAR ALL</button>
          </div>

          {/* Price Range Filter */}
          <div className="fk-filter-group">
            <div className="fk-filter-title">Price Range</div>
            <input
              type="range"
              min="1000"
              max="100000"
              step="1000"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <div className="fk-price-range-val">
              <span>₹1,000</span>
              <span>Up to ₹{maxPrice.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Customer Ratings Filter */}
          <div className="fk-filter-group">
            <div className="fk-filter-title">Customer Ratings</div>
            {[4, 3, 2].map(star => (
              <label key={star} className="fk-filter-option">
                <input
                  type="radio"
                  name="rating"
                  checked={minRating === star}
                  onChange={() => setMinRating(star)}
                />
                <span>{star}★ & above</span>
              </label>
            ))}
            <label className="fk-filter-option">
              <input
                type="radio"
                name="rating"
                checked={minRating === 0}
                onChange={() => setMinRating(0)}
              />
              <span>All Ratings</span>
            </label>
          </div>

          {/* Flipkart Assured Badge Guarantee */}
          <div className="fk-filter-group" style={{ background: '#f8fafc', padding: '10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2874f0', fontWeight: 'bold', fontSize: '13px' }}>
              <i className="fa-solid fa-circle-check"></i>
              <span>Flipkart Assured</span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Quality checked products with guaranteed 2-day delivery & easy returns.
            </div>
          </div>
        </aside>

        {/* Product List Content */}
        <div className="fk-content">
          {/* Sorting Bar */}
          <div className="fk-sort-bar">
            <div className="fk-sort-label">Sort By</div>
            <div className="fk-sort-tabs">
              <div className={`fk-sort-tab ${sortOption === 'popular' ? 'active' : ''}`} onClick={() => setSortOption('popular')}>Popularity</div>
              <div className={`fk-sort-tab ${sortOption === 'price_asc' ? 'active' : ''}`} onClick={() => setSortOption('price_asc')}>Price -- Low to High</div>
              <div className={`fk-sort-tab ${sortOption === 'price_desc' ? 'active' : ''}`} onClick={() => setSortOption('price_desc')}>Price -- High to Low</div>
              <div className={`fk-sort-tab ${sortOption === 'rating' ? 'active' : ''}`} onClick={() => setSortOption('rating')}>Customer Rating</div>
            </div>
          </div>

          {/* Products Grid */}
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', background: '#fff', borderRadius: '2px' }}>
              <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '32px', color: '#2874f0' }}></i>
              <p style={{ marginTop: '12px', color: '#878787' }}>Loading genuine Flipkart products...</p>
            </div>
          ) : products.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', background: '#fff', borderRadius: '2px' }}>
              <i className="fa-solid fa-box-open" style={{ fontSize: '48px', color: '#ccc' }}></i>
              <h3 style={{ marginTop: '16px', color: '#212121' }}>No Products Found</h3>
              <p style={{ color: '#878787', marginTop: '6px' }}>Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="fk-product-grid">
              {products.map(p => (
                <div key={p.id} className="fk-card" onClick={() => setSelectedProduct(p)}>
                  <div className="fk-card-img-wrap">
                    <img src={p.image} alt={p.name} className="fk-card-img" />
                    {p.isFlipkartAssured && (
                      <span style={{ position: 'absolute', top: 0, right: 0, background: '#2874f0', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '2px', fontWeight: 'bold' }}>
                        ✔ Plus
                      </span>
                    )}
                  </div>
                  <div className="fk-card-title" title={p.name}>{p.name}</div>
                  <div className="fk-card-rating">
                    <span className="fk-badge-rating">
                      {p.rating} <i className="fa-solid fa-star" style={{ fontSize: '10px' }}></i>
                    </span>
                    <span className="fk-rating-count">({p.ratingCount.toLocaleString()})</span>
                  </div>
                  <div className="fk-price-box">
                    <span className="fk-price-curr">₹{p.price.toLocaleString('en-IN')}</span>
                    <span className="fk-price-orig">₹{p.originalPrice.toLocaleString('en-IN')}</span>
                    <span className="fk-price-disc">{p.discount}</span>
                  </div>
                  <button className="fk-btn-add" onClick={(e) => addToCart(p, e)}>
                    <i className="fa-solid fa-cart-plus"></i> Add to Cart
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Product Details Modal */}
      {selectedProduct && (
        <div className="fk-modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="fk-modal-body" onClick={(e) => e.stopPropagation()}>
            <button className="fk-modal-close" onClick={() => setSelectedProduct(null)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
            <div className="fk-detail-grid">
              <div>
                <div className="fk-detail-img-box">
                  <img src={selectedProduct.image} alt={selectedProduct.name} className="fk-detail-img" />
                </div>
                <div className="fk-detail-actions">
                  <button className="fk-btn-cart-lg" onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}>
                    <i className="fa-solid fa-cart-shopping"></i> ADD TO CART
                  </button>
                  <button className="fk-btn-buy" onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); setIsCartOpen(true); }}>
                    <i className="fa-solid fa-bolt"></i> BUY NOW
                  </button>
                </div>
              </div>

              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>{selectedProduct.name}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <span className="fk-badge-rating">
                    {selectedProduct.rating} <i className="fa-solid fa-star" style={{ fontSize: '10px' }}></i>
                  </span>
                  <span style={{ fontSize: '13px', color: '#878787' }}>
                    {selectedProduct.ratingCount.toLocaleString()} Ratings & {selectedProduct.reviewsCount.toLocaleString()} Reviews
                  </span>
                  {selectedProduct.isFlipkartAssured && (
                    <span style={{ color: '#2874f0', fontWeight: 'bold', fontSize: '12px' }}>
                      <i className="fa-solid fa-check-circle"></i> Assured
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '18px' }}>
                  <span style={{ fontSize: '28px', fontWeight: '700' }}>₹{selectedProduct.price.toLocaleString('en-IN')}</span>
                  <span style={{ fontSize: '16px', color: '#878787', textDecoration: 'line-through' }}>
                    ₹{selectedProduct.originalPrice.toLocaleString('en-IN')}
                  </span>
                  <span style={{ fontSize: '16px', color: '#388e3c', fontWeight: '700' }}>
                    {selectedProduct.discount}
                  </span>
                </div>

                {/* Available Offers */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '6px' }}>Available Offers</div>
                  <div style={{ fontSize: '13px', color: '#212121', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div><i className="fa-solid fa-tag" style={{ color: '#16a34a', marginRight: '6px' }}></i> <strong>Bank Offer:</strong> 5% Unlimited Cashback on Flipkart Axis Bank Credit Card</div>
                    <div><i className="fa-solid fa-tag" style={{ color: '#16a34a', marginRight: '6px' }}></i> <strong>Special Price:</strong> Get extra 10% off (price inclusive of cashback/coupon)</div>
                    <div><i className="fa-solid fa-tag" style={{ color: '#16a34a', marginRight: '6px' }}></i> <strong>Partner Offer:</strong> Sign-up for Flipkart Pay Later & get ₹500 Gift Card</div>
                  </div>
                </div>

                {/* Highlights / Specs */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>Highlights</div>
                  {selectedProduct.specs.map((spec, idx) => (
                    <div key={idx} className="fk-spec-item">
                      <i className="fa-solid fa-circle" style={{ fontSize: '6px', color: '#878787' }}></i>
                      <span>{spec}</span>
                    </div>
                  ))}
                </div>

                {/* Description */}
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '6px' }}>Product Description</div>
                  <p style={{ fontSize: '13px', color: '#555', lineHeight: '1.6' }}>{selectedProduct.description}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer / Modal */}
      {isCartOpen && (
        <div className="fk-modal-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="fk-cart-panel" onClick={(e) => e.stopPropagation()}>
            <div className="fk-cart-header">
              <span>My Cart ({totalCartCount} items)</span>
              <button className="fk-modal-close" onClick={() => setIsCartOpen(false)} style={{ position: 'static' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {cart.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <i className="fa-solid fa-cart-shopping" style={{ fontSize: '48px', color: '#ccc' }}></i>
                <h3 style={{ marginTop: '14px' }}>Your Cart is Empty!</h3>
                <p style={{ color: '#878787', marginTop: '6px' }}>Explore best offers and add items to your cart.</p>
                <button className="fk-banner-btn" style={{ background: '#2874f0', color: '#fff', marginTop: '16px' }} onClick={() => setIsCartOpen(false)}>
                  Continue Shopping
                </button>
              </div>
            ) : (
              <div>
                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  {cart.map(item => (
                    <div key={item.id} className="fk-cart-item">
                      <img src={item.image} alt={item.name} className="fk-cart-img" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '15px', fontWeight: '600' }}>{item.name}</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '6px 0' }}>
                          <span style={{ fontSize: '16px', fontWeight: '700' }}>₹{item.price.toLocaleString('en-IN')}</span>
                          <span style={{ fontSize: '12px', color: '#878787', textDecoration: 'line-through' }}>₹{item.originalPrice.toLocaleString('en-IN')}</span>
                          <span style={{ fontSize: '12px', color: '#388e3c', fontWeight: '600' }}>{item.discount}</span>
                        </div>
                        <div className="fk-cart-qty-ctrl">
                          <button className="fk-qty-btn" onClick={() => updateCartQty(item.id, -1)}>-</button>
                          <span style={{ fontSize: '14px', fontWeight: '600', padding: '0 8px' }}>{item.qty}</span>
                          <button className="fk-qty-btn" onClick={() => updateCartQty(item.id, 1)}>+</button>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            style={{ marginLeft: '16px', background: 'none', border: 'none', color: '#212121', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
                          >
                            REMOVE
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Price Details summary */}
                <div className="fk-checkout-summary">
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#878787', textTransform: 'uppercase', marginBottom: '12px' }}>
                    PRICE DETAILS
                  </div>
                  <div className="fk-summary-row">
                    <span>Price ({totalCartCount} items)</span>
                    <span>₹{cartOriginalTotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="fk-summary-row" style={{ color: '#388e3c' }}>
                    <span>Discount</span>
                    <span>- ₹{(cartOriginalTotal - cartTotal).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="fk-summary-row">
                    <span>Delivery Charges</span>
                    <span style={{ color: '#388e3c' }}>FREE</span>
                  </div>
                  <div className="fk-summary-row fk-total-row">
                    <span>Total Amount</span>
                    <span>₹{cartTotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div style={{ color: '#388e3c', fontSize: '13px', fontWeight: '600', marginTop: '8px' }}>
                    You will save ₹{(cartOriginalTotal - cartTotal).toLocaleString('en-IN')} on this order
                  </div>

                  <button
                    className="fk-btn-buy"
                    style={{ width: '100%', marginTop: '16px' }}
                    onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
                  >
                    PLACE ORDER
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fk-modal-overlay" onClick={() => setIsCheckoutOpen(false)}>
          <div className="fk-modal-body" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <button className="fk-modal-close" onClick={() => setIsCheckoutOpen(false)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Delivery Address & Payment</h3>
            <form onSubmit={handlePlaceOrder}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#555' }}>Full Name</label>
                  <input
                    type="text"
                    name="fullname"
                    required
                    defaultValue="Rajesh Kumar"
                    style={{ width: '100%', padding: '10px', marginTop: '4px', border: '1px solid #ccc', borderRadius: '3px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#555' }}>Mobile Number</label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    defaultValue="9876543210"
                    style={{ width: '100%', padding: '10px', marginTop: '4px', border: '1px solid #ccc', borderRadius: '3px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#555' }}>Street Address</label>
                <textarea
                  name="address"
                  required
                  rows="2"
                  defaultValue="Flat 402, Sunshine Residency, Outer Ring Road, Bengaluru"
                  style={{ width: '100%', padding: '10px', marginTop: '4px', border: '1px solid #ccc', borderRadius: '3px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#555' }}>Pincode</label>
                <input
                  type="text"
                  name="pincode"
                  required
                  defaultValue="560103"
                  style={{ width: '100%', padding: '10px', marginTop: '4px', border: '1px solid #ccc', borderRadius: '3px' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#212121', display: 'block', marginBottom: '8px' }}>
                  Select Payment Method
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="paymentMethod" value="UPI / PhonePe / Google Pay" defaultChecked />
                    <span>UPI (Google Pay, PhonePe, Paytm, BHIM)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="paymentMethod" value="Credit / Debit / ATM Card" />
                    <span>Credit / Debit Card</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="paymentMethod" value="Cash On Delivery" />
                    <span>Cash on Delivery (COD)</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #eee', paddingTop: '16px' }}>
                <span style={{ fontSize: '16px', fontWeight: '700' }}>Amount to Pay: ₹{cartTotal.toLocaleString('en-IN')}</span>
                <button type="submit" className="fk-btn-buy" style={{ padding: '12px 24px' }}>
                  CONFIRM ORDER
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Confirmation Screen */}
      {orderSuccess && (
        <div className="fk-modal-overlay" onClick={() => setOrderSuccess(null)}>
          <div className="fk-modal-body" style={{ maxWidth: '520px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <i className="fa-solid fa-circle-check" style={{ fontSize: '64px', color: '#388e3c', marginBottom: '16px' }}></i>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#212121' }}>Order Confirmed!</h2>
            <p style={{ color: '#555', marginTop: '6px', fontSize: '14px' }}>
              Thank you for shopping on Flipkart. Your order has been placed.
            </p>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '4px', margin: '20px 0', textAlign: 'left' }}>
              <div style={{ fontSize: '13px', margin: '4px 0' }}><strong>Order ID:</strong> {orderSuccess.orderId}</div>
              <div style={{ fontSize: '13px', margin: '4px 0' }}><strong>Payment:</strong> {orderSuccess.paymentMethod}</div>
              <div style={{ fontSize: '13px', margin: '4px 0' }}><strong>Total Paid:</strong> ₹{orderSuccess.totalAmount.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '13px', margin: '4px 0' }}><strong>Delivery to:</strong> {orderSuccess.customer.name}, {orderSuccess.customer.address}</div>
            </div>
            <button
              className="fk-btn-buy"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setOrderSuccess(null)}
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fk-toast">
          <i className="fa-solid fa-circle-info" style={{ color: '#ffe500' }}></i>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
