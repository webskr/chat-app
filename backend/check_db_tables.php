<?php
include_once 'includes/db_connection.php';

echo "Checking muted_chats table:\n";
try {
    $stmt = $pdo->prepare("DESCRIBE muted_chats");
    $stmt->execute();
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
} catch (Exception $e) {
    echo "muted_chats table not found or error: " . $e->getMessage() . "\n";
}

echo "\nChecking relationships table:\n";
try {
    $stmt = $pdo->prepare("DESCRIBE relationships");
    $stmt->execute();
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
} catch (Exception $e) {
    echo "relationships table not found or error: " . $e->getMessage() . "\n";
}
?>
