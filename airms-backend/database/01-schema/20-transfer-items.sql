CREATE TABLE transfer_items (
    id SERIAL PRIMARY KEY,
    transfer_id INTEGER REFERENCES transfers(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    serial_numbers TEXT[],
    condition VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);