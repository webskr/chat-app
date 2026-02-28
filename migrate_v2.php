<?php
include_once 'backend/includes/db_connection.php';

try {
    // 1. Add is_online column
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online TINYINT(1) DEFAULT 0");
    echo "Added is_online column.\n";

    // 2. Ensure last_active exists (or use last_seen if already there, let's just add it if not)
    // The previous DESCRIBE showed last_seen exists as timestamp. I'll stick with that or add last_active for specific "online" tracking.
    // The requirement says "add columns is_online, last_active".
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active DATETIME NULL");
    echo "Added last_active column.\n";

    // 3. Add scramble_enabled and scramble_value
    // scramble_name exists as tinyint(1). I'll use it as scramble_enabled or add a new one.
    // Let's add scramble_enabled and scramble_value as per requirements to be safe and clean.
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS scramble_enabled TINYINT(1) DEFAULT 0");
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS scramble_value TEXT NULL");
    echo "Added scramble columns.\n";

    echo "Migration completed successfully.\n";
} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
?>
