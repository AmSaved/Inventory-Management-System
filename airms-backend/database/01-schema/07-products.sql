CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    sub_category VARCHAR(50),
    brand VARCHAR(100),
    model VARCHAR(100),
    unit VARCHAR(20),
    barcode_data TEXT,
    qr_code_data TEXT,
    specifications JSONB,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);