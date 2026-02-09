<?php
include_once '../includes/db_connection.php';

try {
    // Add duration column to messages table
    $sql = "ALTER TABLE messages ADD COLUMN duration INT NULL DEFAULT 0";
    $pdo->exec($sql);
    echo "Migration successful: Added duration column to messages table.\n";
} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
?>
