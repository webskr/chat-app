<?php
include_once 'backend/includes/db_connection.php';

try {
    $pdo->exec("ALTER TABLE users 
        ADD COLUMN country VARCHAR(100) DEFAULT NULL,
        ADD COLUMN state VARCHAR(100) DEFAULT NULL,
        ADD COLUMN district VARCHAR(100) DEFAULT NULL");
    echo "Successfully added country, state, and district columns to users table.\n";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'Duplicate column name') !== false) {
        echo "Columns already exist.\n";
    } else {
        echo "Error: " . $e->getMessage() . "\n";
    }
}
?>
