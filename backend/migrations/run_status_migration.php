<?php
include_once __DIR__ . '/../includes/db_connection.php';

try {
    global $pdo; // Ensure $pdo is available if it's defined in the included file
    
    // 1. Add status, delivered_at, read_at to messages
    $sql1 = "SHOW COLUMNS FROM messages LIKE 'status'";
    $stmt1 = $pdo->prepare($sql1);
    $stmt1->execute();
    if ($stmt1->rowCount() == 0) {
        $pdo->exec("ALTER TABLE messages 
                    ADD COLUMN status ENUM('sent', 'delivered', 'seen') DEFAULT 'sent',
                    ADD COLUMN delivered_at TIMESTAMP NULL,
                    ADD COLUMN read_at TIMESTAMP NULL");
        echo "Updated messages table.\n";
    } else {
        echo "Messages table already has status.\n";
    }

    // 2. Add read_receipts to users
    $sql2 = "SHOW COLUMNS FROM users LIKE 'read_receipts'";
    $stmt2 = $pdo->prepare($sql2);
    $stmt2->execute();
    if ($stmt2->rowCount() == 0) {
        $pdo->exec("ALTER TABLE users ADD COLUMN read_receipts TINYINT(1) DEFAULT 1");
        echo "Updated users table.\n";
    } else {
        echo "Users table already has read_receipts.\n";
    }

    echo "Database migration checked/completed successfully.\n";

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
} catch (Error $e) {
    echo "Fatal Error: " . $e->getMessage() . "\n";
}
?>
