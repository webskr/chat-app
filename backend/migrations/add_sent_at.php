<?php
include_once '../includes/db_connection.php';

try {
    $pdo->exec("ALTER TABLE messages ADD COLUMN sent_at TIMESTAMP NULL DEFAULT NULL");
    echo "Column sent_at added successfully.";
} catch (PDOException $e) {
    echo "Error adding column: " . $e->getMessage();
}
?>
