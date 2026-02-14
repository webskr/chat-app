<?php
include_once __DIR__ . '/../includes/db_connection.php';

// Verify $pdo exists
if (!isset($pdo)) {
    die("Error: \$pdo variable not defined in db_connection.php.\n");
}

try {
    echo "Adding One-Time View columns to messages table...\n";

    // 1. Add is_one_time column
    try {
        $pdo->exec("ALTER TABLE messages ADD COLUMN is_one_time TINYINT(1) DEFAULT 0");
        echo "Added is_one_time column.\n";
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'Duplicate column') !== false) {
            echo "Column is_one_time already exists.\n";
        } else {
            throw $e;
        }
    }

    // 2. Add seen_at column
    try {
        $pdo->exec("ALTER TABLE messages ADD COLUMN seen_at TIMESTAMP NULL DEFAULT NULL");
        echo "Added seen_at column.\n";
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'Duplicate column') !== false) {
            echo "Column seen_at already exists.\n";
        } else {
            throw $e;
        }
    }

    // 3. Add delete_after_seconds column
    try {
        $pdo->exec("ALTER TABLE messages ADD COLUMN delete_after_seconds INT DEFAULT 0");
        echo "Added delete_after_seconds column.\n";
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'Duplicate column') !== false) {
            echo "Column delete_after_seconds already exists.\n";
        } else {
            throw $e;
        }
    }

    echo "Migration completed successfully.\n";

} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
?>
