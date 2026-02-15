<?php
include '../includes/db_connection.php';

try {
    // Modify last_message_time to allow NULL
    $sql = "ALTER TABLE conversations MODIFY last_message_time TIMESTAMP NULL DEFAULT NULL";
    $pdo->exec($sql);
    echo "Successfully updated conversations table schema: last_message_time is now nullable.";
} catch (PDOException $e) {
    echo "Error updating schema: " . $e->getMessage();
}
?>
