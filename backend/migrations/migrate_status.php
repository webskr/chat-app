<?php
include_once '../includes/db_connection.php';

try {
    // Update relationship status enum to include accepted/pending for UI compatibility
    $sql = "ALTER TABLE relationships MODIFY COLUMN status ENUM('accepted', 'pending', 'blocked') NOT NULL";
    $pdo->exec($sql);
    
    // Update existing records if any
    $pdo->exec("UPDATE relationships SET status = 'accepted' WHERE status = 'friend'");
    
    echo "Relationship status enum updated successfully!\n";
} catch (PDOException $e) {
    echo "Error updating enum: " . $e->getMessage() . "\n";
}
?>
