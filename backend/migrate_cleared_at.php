<?php
include_once 'db_connection.php';

try {
    // Check if columns exist
    $check_sql = "SHOW COLUMNS FROM conversations LIKE 'user1_cleared_at'";
    $stmt = $pdo->prepare($check_sql);
    $stmt->execute();
    
    if ($stmt->rowCount() == 0) {
        $sql = "ALTER TABLE conversations 
                ADD COLUMN user1_cleared_at TIMESTAMP NULL DEFAULT NULL, 
                ADD COLUMN user2_cleared_at TIMESTAMP NULL DEFAULT NULL";
        $pdo->exec($sql);
        echo "Columns user1_cleared_at and user2_cleared_at added successfully.\n";
    } else {
        echo "Columns already exist.\n";
    }
} catch (PDOException $e) {
    echo "Error updating table: " . $e->getMessage() . "\n";
}
?>
