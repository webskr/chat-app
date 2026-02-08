<?php
include_once '../includes/db_connection.php';

try {
    $sql = "ALTER TABLE users 
            ADD COLUMN border_color VARCHAR(20) DEFAULT '#10B981',
            ADD COLUMN button_color VARCHAR(20) DEFAULT '#10B981'";
    $pdo->exec($sql);
    echo "Columns added successfully.";
} catch (PDOException $e) {
    echo "Error adding columns: " . $e->getMessage();
}
?>
