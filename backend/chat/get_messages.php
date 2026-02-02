<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../includes/db_connection.php';

$sender_id = isset($_GET['sender_id']) ? $_GET['sender_id'] : null;
$receiver_id = isset($_GET['receiver_id']) ? $_GET['receiver_id'] : null;

if (!empty($sender_id) && !empty($receiver_id)) {
    try {
        $user1_id = min((int)$sender_id, (int)$receiver_id);
        $user2_id = max((int)$sender_id, (int)$receiver_id);

        $query = "SELECT m.*, u_sender.username as sender_name, u_sender.avatar_id as sender_avatar_id, m.is_deleted 
                  FROM messages m
                  JOIN conversations c ON m.conversation_id = c.id
                  JOIN users u_sender ON m.sender_id = u_sender.id
                  WHERE (
                      (c.user1_id = :u1 AND c.user2_id = :u2) OR 
                      (c.user1_id = :u2 AND c.user2_id = :u1)
                  )
                  AND (
                      CASE
                          WHEN c.user1_id = c.user2_id THEN 
                               (c.user1_cleared_at IS NULL OR m.created_at > c.user1_cleared_at)
                          WHEN c.user1_id = :me THEN 
                               (c.user1_cleared_at IS NULL OR m.created_at > c.user1_cleared_at)
                          WHEN c.user2_id = :me THEN 
                               (c.user2_cleared_at IS NULL OR m.created_at > c.user2_cleared_at)
                          ELSE 1
                      END
                  )
                  ORDER BY m.created_at ASC";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([':u1' => $user1_id, ':u2' => $user2_id, ':me' => $sender_id]);
        
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch reactions for these messages (resilient if table missing)
        foreach ($messages as &$message) {
            try {
                $react_query = "SELECT r.emoji, r.user_id, u.username 
                                FROM reactions r 
                                JOIN users u ON r.user_id = u.id 
                                WHERE r.message_id = :mid";
                $react_stmt = $pdo->prepare($react_query);
                $react_stmt->execute([':mid' => $message['id']]);
                $message['reactions'] = $react_stmt->fetchAll(PDO::FETCH_ASSOC);
            } catch (PDOException $e) {
                $message['reactions'] = [];
            }
        }
        
        http_response_code(200);
        echo json_encode($messages);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete parameters."));
}
