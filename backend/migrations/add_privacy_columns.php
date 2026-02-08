<?php
include_once __DIR__ . '/../includes/db_connection.php';

try {
    echo "Starting migration: Add privacy columns...\n";

    $columns = [
        'last_seen' => "TIMESTAMP NULL DEFAULT NULL AFTER created_at",
        'privacy_last_seen' => "TINYINT DEFAULT 1 AFTER last_seen",
        'privacy_read_receipts' => "TINYINT DEFAULT 1 AFTER privacy_last_seen",
        'privacy_profile_visibility' => "ENUM('public', 'private') DEFAULT 'public' AFTER privacy_read_receipts"
    ];

    foreach ($columns as $name => $definition) {
        $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE '$name'");
        if ($stmt->rowCount() == 0) {
            $pdo->exec("ALTER TABLE users ADD COLUMN $name $definition");
            echo "Added column '$name'.\n";
        } else {
            echo "Column '$name' already exists.\n";
        }
    }

    echo "Migration complete.\n";

} catch (PDOException $e) {
    die("DB Error: " . $e->getMessage());
}
?>
