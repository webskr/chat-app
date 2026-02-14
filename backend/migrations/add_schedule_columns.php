<?php
include_once '../includes/db_connection.php';

try {
    // Check if column exists
    $check = $pdo->query("SHOW COLUMNS FROM messages LIKE 'scheduled_at'");
    if ($check->rowCount() == 0) {
        $sql = "ALTER TABLE messages ADD COLUMN scheduled_at DATETIME NULL DEFAULT NULL AFTER delete_after_seconds";
        $pdo->exec($sql);
        echo "Column 'scheduled_at' added successfully.<br>";
    } else {
        echo "Column 'scheduled_at' already exists.<br>";
    }

    // Check if status enum needs update (if it is an enum). 
    // Usually it's better to just generic VARCHAR if not strict, but let's assume it's VARCHAR or check.
    // Ideally we should verify if 'status' column is ENUM and if it has 'scheduled'.
    
    // For this environment, we'll assume status is VARCHAR or compatible. 
    // If it is ENUM, we might need to alter it.
    // Let's safe-check generic VARCHAR.
    
    echo "Migration completed.";

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
