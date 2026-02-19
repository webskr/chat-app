<?php
include '../includes/db_connection.php';
try {
    $stmt = $pdo->query("SHOW TABLES LIKE 'group_message_views'");
    $tableExists = $stmt->fetch();
    echo "Table group_message_views exists: " . ($tableExists ? "YES" : "NO") . "\n";
    
    if ($tableExists) {
        $desc = $pdo->query("DESCRIBE group_message_views");
        print_r($desc->fetchAll(PDO::FETCH_ASSOC));
    }
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
