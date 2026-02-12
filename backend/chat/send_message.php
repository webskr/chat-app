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

if (!empty($data->sender_id) && !empty($data->receiver_id) && (!empty($data->message) || !empty($data->image_path) || !empty($data->audio_url) || !empty($data->video_url) || !empty($data->file_url) || !empty($data->gif_url) || !empty($data->sticker_url))) {
    // 0. Validate Message Length
    if (!empty($data->message) && mb_strlen($data->message) > 5000) {
        http_response_code(400);
        echo json_encode(array("message" => "Message is too long (max 5000 characters)."));
        exit();
    }
    try {
        // 0. Rate Limiting Check
        $rate_limit_query = "SELECT COUNT(*) FROM messages 
                             WHERE sender_id = :sid 
                             AND created_at > (NOW() - INTERVAL 1 MINUTE)";
        $rate_stmt = $pdo->prepare($rate_limit_query);
        $rate_stmt->execute([':sid' => $data->sender_id]);
        if ($rate_stmt->fetchColumn() >= 20) {
            http_response_code(429);
            echo json_encode(array("message" => "Too many messages. Please wait a moment."));
            exit();
        }

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

        $msg_content = !empty($data->message) ? $data->message : (!empty($data->audio_url) ? '🎤 Voice Message' : (!empty($data->video_url) ? '🎥 Video' : (!empty($data->file_url) ? '📄 Document' : (!empty($data->gif_url) ? '👾 GIF' : (!empty($data->sticker_url) ? '🧩 Sticker' : '📷 Image')))));

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
        $thumbnail_url = null;
        $file_size = 0;
        
        $image_path = !empty($data->image_path) ? $data->image_path : null;

        if ($image_path) {
            $message_type = 'image';
            $media_url = $image_path;
        } elseif (!empty($data->audio_url)) {
            $message_type = 'voice';
            $media_url = $data->audio_url;
        } elseif (!empty($data->video_url)) {
            $message_type = 'video';
            $media_url = $data->video_url;
            $thumbnail_url = !empty($data->thumbnail_url) ? $data->thumbnail_url : null;
            $file_size = !empty($data->file_size) ? (int)$data->file_size : 0;
        } elseif (!empty($data->file_url)) {
            $message_type = 'document';
            $media_url = $data->file_url;
            $file_size = !empty($data->file_size) ? (int)$data->file_size : 0;
        } elseif (!empty($data->gif_url)) {
            $message_type = 'gif';
            $media_url = $data->gif_url;
        } elseif (!empty($data->sticker_url)) {
            $message_type = 'sticker';
            $media_url = $data->sticker_url;
        }

        $duration = !empty($data->duration) ? (int)$data->duration : 0;
        $file_name = !empty($data->file_name) ? $data->file_name : null;
        $mime_type = !empty($data->mime_type) ? $data->mime_type : null;
        $reply_to_message_id = !empty($data->reply_to_message_id) ? (int)$data->reply_to_message_id : null;

        // 2. Insert Message
        $msg_query = "INSERT INTO messages (conversation_id, sender_id, receiver_id, message_text, message_type, media_url, thumbnail_url, duration, file_size, file_name, mime_type, reply_to_message_id) 
                      VALUES (:cid, :sid, :rid, :msg, :type, :media, :thumb, :dur, :size, :fname, :mime, :reply_id)";
        $msg_stmt = $pdo->prepare($msg_query);
        
        $message_text = !empty($data->message) ? $data->message : '';

        if ($msg_stmt->execute([
            ':cid' => $conv_id, 
            ':sid' => $data->sender_id, 
            ':rid' => $data->receiver_id, 
            ':msg' => $message_text,
            ':type' => $message_type,
            ':media' => $media_url,
            ':thumb' => $thumbnail_url,
            ':dur' => $duration,
            ':size' => $file_size,
            ':fname' => $file_name,
            ':mime' => $mime_type,
            ':reply_id' => $reply_to_message_id
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
