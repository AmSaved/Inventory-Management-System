CREATE TABLE request_items (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity_requested INTEGER NOT NULL CHECK (quantity_requested > 0),
    quantity_approved INTEGER,
    quantity_fulfilled INTEGER DEFAULT 0,
    specifications JSONB,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);