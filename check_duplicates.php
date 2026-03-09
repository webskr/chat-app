<?php
include_once 'backend/includes/db_connection.php';

echo "--- Conversations with duplicate group_id ---\n";
$stmt = $pdo->query("SELECT group_id, COUNT(*) as count FROM conversations WHERE is_group = 1 AND group_id IS NOT NULL GROUP BY group_id HAVING count > 1");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "Group ID: " . $row['group_id'] . " - Count: " . $row['count'] . "\n";
    
    // List the conversation IDs for this group
    $stmt2 = $pdo->prepare("SELECT id, last_message_time FROM conversations WHERE group_id = :gid");
    $stmt2->execute([':gid' => $row['group_id']]);
    while ($conv = $stmt2->fetch(PDO::FETCH_ASSOC)) {
        echo "  - Conv ID: " . $conv['id'] . " (Last Message: " . $conv['last_message_time'] . ")\n";
    }
}

echo "\n--- Conversations with missing group entries ---\n";
$stmt = $pdo->query("SELECT c.id, c.group_id FROM conversations c LEFT JOIN groups g ON c.group_id = g.id WHERE c.is_group = 1 AND g.id IS NULL");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "Conv ID: " . $row['id'] . " - Missing Group ID: " . $row['group_id'] . "\n";
}
?>
