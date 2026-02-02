<?php
include_once '../includes/db_connection.php';
$data = [];

$stmt = $pdo->query("SELECT m.id, m.conversation_id, m.created_at as msg_created, 
                            c.user1_id, c.user2_id, c.user1_cleared_at, c.user2_cleared_at
                     FROM messages m 
                     JOIN conversations c ON m.conversation_id = c.id");
$data['comparisons'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($data, JSON_PRETTY_PRINT);
?>
