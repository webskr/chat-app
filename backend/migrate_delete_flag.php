<?php
include_once 'db_connection.php';

try {
    // Check if column exists
    $check_sql = "SHOW COLUMNS FROM messages LIKE 'is_deleted'";
    $stmt = $pdo->prepare($check_sql);
    $stmt->execute();
    
    if ($stmt->rowCount() == 0) {
        $sql = "ALTER TABLE messages ADD COLUMN is_deleted BOOLEAN DEFAULT 0";
        $pdo->exec($sql);
        echo "Column 'is_deleted' added successfully.\n";
    } else {
        echo "Column 'is_deleted' already exists.\n";
    }
} catch (PDOException $e) {
    echo "Error updating table: " . $e->getMessage() . "\n";
}
?>
