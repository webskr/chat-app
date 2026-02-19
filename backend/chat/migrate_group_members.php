<?php
include '../includes/db_connection.php';

try {
    $pdo->exec("ALTER TABLE group_members ADD COLUMN cleared_at DATETIME NULL");
    echo "Column cleared_at added successfully.";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
