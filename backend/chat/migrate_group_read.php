<?php
// Fix path: use __DIR__ to be safe
include_once __DIR__ . '/../includes/db_connection.php';

try {
    echo "Checking group_members table...\n";
    
    // Check if column exists
    $check = $pdo->query("SHOW COLUMNS FROM group_members LIKE 'last_read_at'");
    if ($check->rowCount() == 0) {
        echo "Adding last_read_at column...\n";
        $pdo->exec("ALTER TABLE group_members ADD COLUMN last_read_at TIMESTAMP NULL DEFAULT NULL");
        echo "Column added successfully.\n";
    } else {
        echo "Column last_read_at already exists.\n";
    }

    echo "Migration completed.\n";

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
