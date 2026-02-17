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
        // 0. Rate Limiting Check (Skip for Official Accounts)
        $is_official_stmt = $pdo->prepare("SELECT is_official FROM users WHERE id = :sid");
        $is_official_stmt->execute([':sid' => $data->sender_id]);
        $is_official = $is_official_stmt->fetchColumn();

        if (!$is_official) {
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

        // OTV Fields
        $is_one_time = !empty($data->is_one_time) ? 1 : 0;

        // Validate OTV Text Length
        if ($is_one_time && empty($media_url) && !empty($data->message) && mb_strlen($data->message) > 200) {
            http_response_code(400);
            echo json_encode(array("message" => "One-Time View text messages are limited to 200 characters."));
            exit();
        }

        // Default 5 minutes if not specified, only if is_one_time
        $delete_after_seconds = ($is_one_time && !empty($data->delete_after_seconds)) ? (int)$data->delete_after_seconds : ($is_one_time ? 300 : 0);

        // Scheduled Message
        $scheduled_at = !empty($data->scheduled_at) ? $data->scheduled_at : null;
        $status = $scheduled_at ? 'scheduled' : 'sent';
        // NEW: Set sent_at if sending immediately
        $sent_at = ($status === 'sent') ? date('Y-m-d H:i:s') : null;

        // 2. Insert Message
        $msg_query = "INSERT INTO messages (conversation_id, sender_id, receiver_id, message_text, message_type, media_url, thumbnail_url, duration, file_size, file_name, mime_type, reply_to_message_id, is_one_time, delete_after_seconds, scheduled_at, status, sent_at) 
                      VALUES (:cid, :sid, :rid, :msg, :type, :media, :thumb, :dur, :size, :fname, :mime, :reply_id, :is_ot, :del_sec, :sch_at, :status, :sent_at)";
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
            ':reply_id' => $reply_to_message_id,
            ':is_ot' => $is_one_time,
            ':del_sec' => $delete_after_seconds,
            ':sch_at' => $scheduled_at,
            ':status' => $status,
            ':sent_at' => $sent_at
        ])) {
            // --- Push Notification Logic ---
            if ($status === 'sent') { // Only notify if sent immediately (not scheduled)
                try {
                    // Check if receiver has a device token and if chat is muted
                    $notif_query = "
                        SELECT u.device_token, 
                               (SELECT COUNT(*) FROM muted_chats WHERE user_id = :rid AND target_id = :sid AND mute_until > NOW()) as is_muted,
                               u.display_name
                        FROM users u
                        WHERE u.id = :rid
                    ";
                    $notif_stmt = $pdo->prepare($notif_query);
                    $notif_stmt->execute([':rid' => $data->receiver_id, ':sid' => $data->sender_id]);
                    $receiver_info = $notif_stmt->fetch(PDO::FETCH_ASSOC);

                    if ($receiver_info && !empty($receiver_info['device_token']) && $receiver_info['is_muted'] == 0) {
                        include_once '../includes/push_service.php';
                        
                        // Get Sender Name
                        $sender_name_query = "SELECT username, display_name FROM users WHERE id = :sid";
                        $sender_stmt = $pdo->prepare($sender_name_query);
                        $sender_stmt->execute([':sid' => $data->sender_id]);
                        $sender_row = $sender_stmt->fetch(PDO::FETCH_ASSOC);

                        // Use display_name if set, otherwise username
                        $sender_name = !empty($sender_row['display_name']) ? $sender_row['display_name'] : $sender_row['username'];

                        $title = $sender_name;
                        $body = '';
                        
                        // Construct Body based on Message Type and OTV
                        if ($is_one_time) {
                            $body = "New private message";
                        } else {
                            switch ($message_type) {
                                case 'text':
                                    $body = mb_substr($message_text, 0, 30) . (mb_strlen($message_text) > 30 ? '...' : '');
                                    break;
                                case 'image':
                                    $body = "📷 Photo";
                                    break;
                                case 'video':
                                    $body = "🎥 Video";
                                    break;
                                case 'voice':
                                    $body = "🎤 Voice Message";
                                    break;
                                case 'document':
                                    $body = "📄 Document";
                                    break;
                                case 'gif':
                                    $body = "👾 GIF";
                                    break;
                                case 'sticker':
                                    $body = "🧩 Sticker";
                                    break;
                                default:
                                    $body = "New message";
                            }
                        }

                        // Payload for Deep Linking
                        $payload = [
                            'type' => 'new_message',
                            'conversation_id' => $conv_id,
                            'sender_id' => $data->sender_id,
                            'sender_name' => $sender_name,
                            'message_id' => $pdo->lastInsertId() // Approximate, valid enough for nav
                        ];

                        sendPushNotification($receiver_info['device_token'], $title, $body, $payload);
                    }
                } catch (Exception $e) {
                    // Ignore notification errors to not fail the message send
                }
            }
            // --- End Push Notification Logic ---

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
