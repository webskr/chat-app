<?php
include '../includes/db_connection.php';
try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $sql = "CREATE TABLE group_message_views (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT NOT NULL,
        user_id INT NOT NULL,
        group_id INT NOT NULL,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_view (message_id, user_id)
    ) ENGINE=InnoDB";
    
    // Drop if exists first to be sure
    $pdo->exec("DROP TABLE IF EXISTS group_message_views");
    $pdo->exec($sql);
    echo "Table dropped and created.\n";
    
    $tables = $pdo->query("SHOW TABLES LIKE 'group_message_views'")->fetchAll();
    print_r($tables);
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
