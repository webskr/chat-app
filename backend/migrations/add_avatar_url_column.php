<?php
include_once '../includes/db_connection.php';

try {
    // Add avatar_url column
    $sql = "SHOW COLUMNS FROM users LIKE 'avatar_url'";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    
    if ($stmt->rowCount() == 0) {
        $alter = "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) DEFAULT NULL AFTER avatar_id";
        $pdo->exec($alter);
        echo "Successfully added 'avatar_url' column.\n";
    } else {
        echo "'avatar_url' column already exists.\n";
    }

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
