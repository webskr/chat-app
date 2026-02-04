<?php
require __DIR__ . '/../includes/db_connection.php';

try {
    echo "Starting migration...\n";

    // 1. Backfill media_url from image_path
    $sql_backfill = "UPDATE messages SET media_url = image_path WHERE media_url IS NULL AND image_path IS NOT NULL";
    $count = $pdo->exec($sql_backfill);
    echo "Backfilled $count rows from image_path to media_url.\n";

    // 2. Drop unique key if exists (unlikely for image_path but good to check, or just ignore error)
    // 3. Drop image_path column
    // Check if column exists first to avoid error on re-run
    $stmt = $pdo->query("SHOW COLUMNS FROM messages LIKE 'image_path'");
    if ($stmt->rowCount() > 0) {
        $sql_drop = "ALTER TABLE messages DROP COLUMN image_path";
        $pdo->exec($sql_drop);
        echo "Dropped column 'image_path'.\n";
    } else {
        echo "Column 'image_path' already dropped.\n";
    }

    echo "Migration complete.\n";

} catch (PDOException $e) {
    die("DB Error: " . $e->getMessage());
}
?>
