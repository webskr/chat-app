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

if (!empty($data->sender_id) && !empty($data->receiver_id) && (!empty($data->message) || !empty($data->image_path))) {
    try {
        // ... (block check kept same, hidden for brevity in apply) ... 

        // 0. Check for Blocked Status
        $block_check = "SELECT COUNT(*) FROM relationships 
                        WHERE status = 'blocked' 
                        AND (
                            (user_id = :sid AND target_id = :rid) 
                            OR 
                            (user_id = :rid AND target_id = :sid)
                        )";
        $block_stmt = $pdo->prepare($block_check);
        $block_stmt->execute([':sid' => $data->sender_id, ':rid' => $data->receiver_id]);
        if ($block_stmt->fetchColumn() > 0) {
            http_response_code(403);
            echo json_encode(array("message" => "You cannot send messages to this user."));
            exit();
        }

        // Ensure user1_id < user2_id for unique conversation key
        $user1_id = min((int)$data->sender_id, (int)$data->receiver_id);
        $user2_id = max((int)$data->sender_id, (int)$data->receiver_id);

        $msg_content = !empty($data->message) ? $data->message : '📷 Image';

        // 1. Get or Create Conversation
        $conv_query = "INSERT INTO conversations (user1_id, user2_id, last_message) 
                       VALUES (:u1, :u2, :msg) 
                       ON DUPLICATE KEY UPDATE last_message = :msg, last_message_time = CURRENT_TIMESTAMP";
        $conv_stmt = $pdo->prepare($conv_query);
        $conv_stmt->execute([':u1' => $user1_id, ':u2' => $user2_id, ':msg' => $msg_content]);

        // Get conversation ID
        $get_conv = "SELECT id FROM conversations WHERE user1_id = :u1 AND user2_id = :u2";
        $get_stmt = $pdo->prepare($get_conv);
        $get_stmt->execute([':u1' => $user1_id, ':u2' => $user2_id]);
        $conv = $get_stmt->fetch(PDO::FETCH_ASSOC);
        $conv_id = $conv['id'];

        // Determine type and media
        $message_type = 'text';
        $media_url = null;
        $image_path = !empty($data->image_path) ? $data->image_path : null;

        if ($image_path) {
            $message_type = 'image';
            $media_url = $image_path;
        }

        // 2. Insert Message
        $msg_query = "INSERT INTO messages (conversation_id, sender_id, receiver_id, message_text, message_type, media_url) 
                      VALUES (:cid, :sid, :rid, :msg, :type, :media)";
        $msg_stmt = $pdo->prepare($msg_query);
        
        $message_text = !empty($data->message) ? $data->message : '';

        if ($msg_stmt->execute([
            ':cid' => $conv_id, 
            ':sid' => $data->sender_id, 
            ':rid' => $data->receiver_id, 
            ':msg' => $message_text,
            ':type' => $message_type,
            ':media' => $media_url
        ])) {
            http_response_code(200);
            echo json_encode(array("message" => "Message sent.", "conversation_id" => $conv_id));
        } else {
            http_response_code(503);
            echo json_encode(array("message" => "Unable to send message."));
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data."));
}
