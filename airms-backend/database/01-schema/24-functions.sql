-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to generate request number
CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    sequence_num TEXT;
BEGIN
    year_prefix := TO_CHAR(NEW.created_at, 'YYYY');
    SELECT LPAD(COALESCE(MAX(SUBSTRING(request_number FROM 6))::INTEGER + 1, 1)::TEXT, 6, '0')
    INTO sequence_num
    FROM requests
    WHERE request_number LIKE 'REQ-' || year_prefix || '-%';
    
    NEW.request_number := 'REQ-' || year_prefix || '-' || sequence_num;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to generate discharge number
CREATE OR REPLACE FUNCTION generate_discharge_number()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    sequence_num TEXT;
BEGIN
    year_prefix := TO_CHAR(NEW.created_at, 'YYYY');
    SELECT LPAD(COALESCE(MAX(SUBSTRING(discharge_number FROM 6))::INTEGER + 1, 1)::TEXT, 6, '0')
    INTO sequence_num
    FROM discharge_forms
    WHERE discharge_number LIKE 'DSC-' || year_prefix || '-%';
    
    NEW.discharge_number := 'DSC-' || year_prefix || '-' || sequence_num;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to generate store number
CREATE OR REPLACE FUNCTION generate_store_number()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    sequence_num TEXT;
BEGIN
    year_prefix := TO_CHAR(NEW.created_at, 'YYYY');
    SELECT LPAD(COALESCE(MAX(SUBSTRING(store_number FROM 6))::INTEGER + 1, 1)::TEXT, 6, '0')
    INTO sequence_num
    FROM store_forms
    WHERE store_number LIKE 'STR-' || year_prefix || '-%';
    
    NEW.store_number := 'STR-' || year_prefix || '-' || sequence_num;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to generate assignment number
CREATE OR REPLACE FUNCTION generate_assignment_number()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    sequence_num TEXT;
BEGIN
    year_prefix := TO_CHAR(NEW.created_at, 'YYYY');
    SELECT LPAD(COALESCE(MAX(SUBSTRING(assignment_number FROM 6))::INTEGER + 1, 1)::TEXT, 6, '0')
    INTO sequence_num
    FROM assignments
    WHERE assignment_number LIKE 'ASN-' || year_prefix || '-%';
    
    NEW.assignment_number := 'ASN-' || year_prefix || '-' || sequence_num;
    RETURN NEW;
END;
$$ language 'plpgsql';