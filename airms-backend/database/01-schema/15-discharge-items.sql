CREATE TABLE discharge_items (
    id SERIAL PRIMARY KEY,
    discharge_form_id INTEGER REFERENCES discharge_forms(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    serial_numbers TEXT[],
    condition VARCHAR(20) DEFAULT 'new',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);