<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once 'db_connection.php';

$user_id = isset($_GET['user_id']) ? $_GET['user_id'] : null;

if (!empty($user_id)) {
    try {
        $query = "SELECT c.id, c.last_message, c.last_message_time, 
                         u.id as other_user_id, u.username as other_username, u.avatar_id as other_avatar_id
                  FROM conversations c
                  JOIN users u ON (c.user1_id = u.id OR c.user2_id = u.id)
                  WHERE (c.user1_id = :uid OR c.user2_id = :uid) 
                  AND ( (c.user1_id != c.user2_id AND u.id != :uid) OR (c.user1_id = c.user2_id AND u.id = :uid) )
                  ORDER BY c.last_message_time DESC";
        
        $stmt = $pdo->prepare($query);
        $stmt->bindParam(':uid', $user_id);
        $stmt->execute();
        
        $conversations = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        http_response_code(200);
        echo json_encode($conversations);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "User ID required."));
}
