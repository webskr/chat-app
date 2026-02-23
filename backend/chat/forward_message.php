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

if (!empty($data->sender_id) && !empty($data->receiver_ids) && !empty($data->message_id)) {
    try {
        $pdo->beginTransaction();

        // 1. Fetch original message details
        $fetch_orig = "SELECT * FROM messages WHERE id = :mid LIMIT 1";
        $orig_stmt = $pdo->prepare($fetch_orig);
        $orig_stmt->execute([':mid' => $data->message_id]);
        $orig = $orig_stmt->fetch(PDO::FETCH_ASSOC);

        if (!$orig) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(["message" => "Original message not found."]);
            exit();
        }

        $results = [];

        foreach ($data->receiver_ids as $receiver_id) {
            // 2. Get or Create Conversation
            $user1_id = min((int)$data->sender_id, (int)$receiver_id);
            $user2_id = max((int)$data->sender_id, (int)$receiver_id);

            // Determine display text for last_message preview
            $msg_content = "Forwarded message"; 
            if ($orig['message_type'] === 'text') {
                $msg_content = $orig['message_text'];
            } elseif ($orig['message_type'] === 'voice') {
                $msg_content = '🎤 Voice Message';
            } elseif ($orig['message_type'] === 'video') {
                $msg_content = '🎥 Video';
            } elseif ($orig['message_type'] === 'document') {
                $msg_content = '📄 Document';
            } elseif ($orig['message_type'] === 'gif') {
                $msg_content = '👾 GIF';
            } elseif ($orig['message_type'] === 'sticker') {
                $msg_content = '🧩 Sticker';
            } elseif ($orig['message_type'] === 'image') {
                $msg_content = '📷 Image';
            }

            $conv_query = "INSERT INTO conversations (user1_id, user2_id, last_message) 
                           VALUES (:u1, :u2, :msg) 
                           ON DUPLICATE KEY UPDATE last_message = :msg, last_message_time = CURRENT_TIMESTAMP";
            $conv_stmt = $pdo->prepare($conv_query);
            $conv_stmt->execute([':u1' => $user1_id, ':u2' => $user2_id, ':msg' => $msg_content]);

            $get_conv = "SELECT id FROM conversations WHERE user1_id = :u1 AND user2_id = :u2";
            $get_stmt = $pdo->prepare($get_conv);
            $get_stmt->execute([':u1' => $user1_id, ':u2' => $user2_id]);
            $conv = $get_stmt->fetch(PDO::FETCH_ASSOC);
            $conv_id = $conv['id'];

            // 3. Insert new forwarded message
            $ins_msg = "INSERT INTO messages (
                conversation_id, sender_id, receiver_id, message_text, message_type, 
                media_id, is_forwarded, forwarded_from_message_id
            ) VALUES (
                :cid, :sid, :rid, :txt, :type, 
                :media_id, 1, :orig_id
            )";
            
            $ins_stmt = $pdo->prepare($ins_msg);
            $ins_stmt->execute([
                ':cid' => $conv_id,
                ':sid' => $data->sender_id,
                ':rid' => $receiver_id,
                ':txt' => $orig['message_text'],
                ':type' => $orig['message_type'],
                ':media_id' => $orig['media_id'],
                ':orig_id' => $data->message_id
            ]);
            
            $new_message_id = $pdo->lastInsertId();
            
            // 3.1 Initialize Media Tracking
            if ($orig['media_id']) {
                $tracking_stmt = $pdo->prepare("INSERT INTO media_tracking (media_id, message_id, sender_id, receiver_id, status) VALUES (:mid, :msgid, :sid, :rid, 'pending')");
                $tracking_stmt->execute([
                    ':mid' => $orig['media_id'],
                    ':msgid' => $new_message_id,
                    ':sid' => $data->sender_id,
                    ':rid' => $receiver_id
                ]);
            }

            $results[] = [
                "receiver_id" => $receiver_id,
                "message_id" => $new_message_id
            ];
        }

        $pdo->commit();
        http_response_code(200);
        echo json_encode(["message" => "Forward successful", "results" => $results]);

    } catch (PDOException $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data."]);
}
?>
