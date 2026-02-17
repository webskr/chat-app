<?php
include_once '../includes/db_connection.php';

try {
    $sql = "ALTER TABLE users ADD COLUMN is_official TINYINT(1) DEFAULT 0";
    $pdo->exec($sql);
    echo "Added is_official column to users table.";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), "Duplicate column name") !== false) {
        echo "Column is_official already exists.";
    } else {
        echo "Error: " . $e->getMessage();
    }
}
?>
