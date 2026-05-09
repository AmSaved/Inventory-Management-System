-- Backup script example
COPY (SELECT * FROM users) TO '/tmp/backup/users.csv' DELIMITER ',' CSV HEADER;
COPY (SELECT * FROM products) TO '/tmp/backup/products.csv' DELIMITER ',' CSV HEADER;
COPY (SELECT * FROM inventory) TO '/tmp/backup/inventory.csv' DELIMITER ',' CSV HEADER;
COPY (SELECT * FROM requests) TO '/tmp/backup/requests.csv' DELIMITER ',' CSV HEADER;