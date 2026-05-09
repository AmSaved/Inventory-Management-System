CREATE OR REPLACE FUNCTION generate_request_number() RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    sequence_num TEXT;
BEGIN
    year_prefix := TO_CHAR(COALESCE(NEW.created_at, CURRENT_TIMESTAMP), 'YYYY');
    SELECT LPAD(COALESCE(MAX(SUBSTRING(request_number FROM 10))::INTEGER + 1, 1)::TEXT, 6, '0')
    INTO sequence_num
    FROM requests
    WHERE request_number LIKE 'REQ-' || year_prefix || '-%';
    
    NEW.request_number := 'REQ-' || year_prefix || '-' || sequence_num;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION generate_discharge_number() RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    sequence_num TEXT;
BEGIN
    year_prefix := TO_CHAR(COALESCE(NEW.created_at, CURRENT_TIMESTAMP), 'YYYY');
    SELECT LPAD(COALESCE(MAX(SUBSTRING(discharge_number FROM 10))::INTEGER + 1, 1)::TEXT, 6, '0')
    INTO sequence_num
    FROM discharge_forms
    WHERE discharge_number LIKE 'DSC-' || year_prefix || '-%';
    
    NEW.discharge_number := 'DSC-' || year_prefix || '-' || sequence_num;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION generate_store_number() RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    sequence_num TEXT;
BEGIN
    year_prefix := TO_CHAR(COALESCE(NEW.created_at, CURRENT_TIMESTAMP), 'YYYY');
    SELECT LPAD(COALESCE(MAX(SUBSTRING(store_number FROM 10))::INTEGER + 1, 1)::TEXT, 6, '0')
    INTO sequence_num
    FROM store_forms
    WHERE store_number LIKE 'STR-' || year_prefix || '-%';
    
    NEW.store_number := 'STR-' || year_prefix || '-' || sequence_num;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION generate_assignment_number() RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    sequence_num TEXT;
BEGIN
    year_prefix := TO_CHAR(COALESCE(NEW.created_at, CURRENT_TIMESTAMP), 'YYYY');
    SELECT LPAD(COALESCE(MAX(SUBSTRING(assignment_number FROM 10))::INTEGER + 1, 1)::TEXT, 6, '0')
    INTO sequence_num
    FROM assignments
    WHERE assignment_number LIKE 'ASN-' || year_prefix || '-%';
    
    NEW.assignment_number := 'ASN-' || year_prefix || '-' || sequence_num;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION generate_return_number() RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    sequence_num TEXT;
BEGIN
    year_prefix := TO_CHAR(COALESCE(NEW.created_at, CURRENT_TIMESTAMP), 'YYYY');
    SELECT LPAD(COALESCE(MAX(SUBSTRING(return_number FROM 10))::INTEGER + 1, 1)::TEXT, 6, '0')
    INTO sequence_num
    FROM returns
    WHERE return_number LIKE 'RET-' || year_prefix || '-%';
    
    NEW.return_number := 'RET-' || year_prefix || '-' || sequence_num;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION generate_transfer_number() RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    sequence_num TEXT;
BEGIN
    year_prefix := TO_CHAR(COALESCE(NEW.created_at, CURRENT_TIMESTAMP), 'YYYY');
    SELECT LPAD(COALESCE(MAX(SUBSTRING(transfer_number FROM 10))::INTEGER + 1, 1)::TEXT, 6, '0')
    INTO sequence_num
    FROM transfers
    WHERE transfer_number LIKE 'TRF-' || year_prefix || '-%';
    
    NEW.transfer_number := 'TRF-' || year_prefix || '-' || sequence_num;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION generate_issue_number() RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    sequence_num TEXT;
BEGIN
    year_prefix := TO_CHAR(COALESCE(NEW.created_at, CURRENT_TIMESTAMP), 'YYYY');
    SELECT LPAD(COALESCE(MAX(SUBSTRING(issue_number FROM 10))::INTEGER + 1, 1)::TEXT, 6, '0')
    INTO sequence_num
    FROM issues
    WHERE issue_number LIKE 'ISS-' || year_prefix || '-%';
    
    NEW.issue_number := 'ISS-' || year_prefix || '-' || sequence_num;
    RETURN NEW;
END;
$$ language 'plpgsql';
