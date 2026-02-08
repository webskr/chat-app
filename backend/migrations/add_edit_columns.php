<?php
include_once '../includes/db_connection.php';

try {
    // Add is_edited column
    $sql1 = "ALTER TABLE messages ADD COLUMN is_edited BOOLEAN DEFAULT FALSE";
    $pdo->exec($sql1);
    echo "Added is_edited column successfully.\n";
} catch (PDOException $e) {
    echo "Error adding is_edited (might already exist): " . $e->getMessage() . "\n";
}

try {
    // Add edited_at column
    $sql2 = "ALTER TABLE messages ADD COLUMN edited_at TIMESTAMP NULL DEFAULT NULL";
    $pdo->exec($sql2);
    echo "Added edited_at column successfully.\n";
} catch (PDOException $e) {
    echo "Error adding edited_at (might already exist): " . $e->getMessage() . "\n";
}
?>
