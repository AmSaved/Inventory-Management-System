CREATE TABLE return_items (
    id SERIAL PRIMARY KEY,
    return_id INTEGER REFERENCES returns(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    condition VARCHAR(20),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);