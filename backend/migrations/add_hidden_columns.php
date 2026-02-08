<?php
include_once __DIR__ . '/../includes/db_connection.php';

try {
    // Add columns for "Delete for Me"
    $sql1 = "ALTER TABLE messages ADD COLUMN hidden_for_sender TINYINT DEFAULT 0";
    $sql2 = "ALTER TABLE messages ADD COLUMN hidden_for_receiver TINYINT DEFAULT 0";
    
    // Check if columns exist first (optional but safer)
    $columns = $pdo->query("DESCRIBE messages")->fetchAll(PDO::FETCH_COLUMN);
    
    if (!in_array('hidden_for_sender', $columns)) {
        $pdo->exec($sql1);
        echo "Added hidden_for_sender column." . PHP_EOL;
    }
    
    if (!in_array('hidden_for_receiver', $columns)) {
        $pdo->exec($sql2);
        echo "Added hidden_for_receiver column." . PHP_EOL;
    }

    echo "Migration completed successfully." . PHP_EOL;

} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . PHP_EOL;
}
?>
