CREATE TABLE store_items (
    id SERIAL PRIMARY KEY,
    store_form_id INTEGER REFERENCES store_forms(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2),
    batch_number VARCHAR(100),
    expiry_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);