<?php
require __DIR__ . '/../includes/db_connection.php';

try {
    // 1. Add message_type column
    $stmt = $pdo->query("SHOW COLUMNS FROM messages LIKE 'message_type'");
    if ($stmt->rowCount() == 0) {
        $sql = "ALTER TABLE messages ADD COLUMN message_type ENUM('text', 'image', 'video', 'audio') DEFAULT 'text' AFTER receiver_id";
        $pdo->exec($sql);
        echo "Added 'message_type' column.\n";
    } else {
        echo "'message_type' column already exists.\n";
    }

    // 2. Add media_url column (if not exists) - we already have image_path, so essentially we can make media_url a specific column if needed, or just alias it. 
    // User asked for 'media_url'. creating it to be precise.
    $stmt = $pdo->query("SHOW COLUMNS FROM messages LIKE 'media_url'");
    if ($stmt->rowCount() == 0) {
        $sql = "ALTER TABLE messages ADD COLUMN media_url VARCHAR(255) NULL AFTER message_text";
        $pdo->exec($sql);
        echo "Added 'media_url' column.\n";
    } else {
        echo "'media_url' column already exists.\n";
    }
    
    // Optional: Migrate existing image_path data to data structure if needed, or just keep image_path usage.
    // For now, let's keep image_path as legacy if we switch, or just use media_url.
    // Let's decide to use media_url going forward for 'image' type messages.

} catch (PDOException $e) {
    die("DB Error: " . $e->getMessage());
}
?>
