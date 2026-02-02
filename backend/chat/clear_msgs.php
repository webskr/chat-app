<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../includes/db_connection.php';

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->user_id) && !empty($data->target_id)) {
    try {
        $user_id = $data->user_id;
        $target_id = $data->target_id;

        // Determine if user is user1 or user2 in the conversations table
        // We assume the conversation exists if they are chatting
        $find_query = "SELECT id, user1_id, user2_id FROM conversations 
                       WHERE (user1_id = :u1 AND user2_id = :u2) 
                          OR (user1_id = :u2 AND user2_id = :u1) LIMIT 1";
        $stmt = $pdo->prepare($find_query);
        $stmt->execute([':u1' => $user_id, ':u2' => $target_id]);
        $conversation = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($conversation) {
            $c_id = $conversation['id'];
            $u1 = $conversation['user1_id'];
            $u2 = $conversation['user2_id'];

            if ($u1 == $u2) {
                // Self chat: update both to be safe
                $update_sql = "UPDATE conversations SET user1_cleared_at = NOW(), user2_cleared_at = NOW() WHERE id = :cid";
            } elseif ($u1 == $user_id) {
                $update_sql = "UPDATE conversations SET user1_cleared_at = NOW() WHERE id = :cid";
            } else {
                $update_sql = "UPDATE conversations SET user2_cleared_at = NOW() WHERE id = :cid";
            }

            $upd_stmt = $pdo->prepare($update_sql);
            if ($upd_stmt->execute([':cid' => $c_id])) {
                http_response_code(200);
                echo json_encode(array("message" => "Chat cleared successfully."));
            } else {
                http_response_code(500);
                echo json_encode(array("message" => "Unable to clear chat."));
            }
        } else {
             // Conversation doesn't exist yet, nothing to clear
             http_response_code(200);
             echo json_encode(array("message" => "Chat cleared (no conversation found)."));
        }

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data."));
}
?>
