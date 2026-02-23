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

// Validation: Must have sender. Must have receiver OR group_id.
if (empty($data->sender_id) || (empty($data->receiver_id) && empty($data->group_id))) {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data. Sender and (Receiver or Group) required."));
    exit();
}

$sender_id = $data->sender_id;
$receiver_id = !empty($data->receiver_id) ? $data->receiver_id : null;
$group_id = !empty($data->group_id) ? $data->group_id : null;
$is_group = !empty($group_id);

if ((!empty($data->message) || !empty($data->image_path) || !empty($data->audio_url) || !empty($data->video_url) || !empty($data->file_url) || !empty($data->gif_url) || !empty($data->sticker_url))) {
    
    // 0. Validate Message Length
    if (!empty($data->message) && mb_strlen($data->message) > 5000) {
        http_response_code(400);
        echo json_encode(array("message" => "Message is too long (max 5000 characters)."));
        exit();
    }

    try {
        // 0. Rate Limiting (Skip for Official)
        $is_official_stmt = $pdo->prepare("SELECT is_official FROM users WHERE id = :sid");
        $is_official_stmt->execute([':sid' => $sender_id]);
        $is_official = $is_official_stmt->fetchColumn();

        if (!$is_official) {
            $rate_limit_query = "SELECT COUNT(*) FROM messages 
                                 WHERE sender_id = :sid 
                                 AND created_at > (NOW() - INTERVAL 1 MINUTE)";
            $rate_stmt = $pdo->prepare($rate_limit_query);
            $rate_stmt->execute([':sid' => $sender_id]);
            if ($rate_stmt->fetchColumn() >= 20) {
                http_response_code(429);
                echo json_encode(array("message" => "Too many messages. Please wait a moment."));
                exit();
            }
        }

        $conv_id = null;

        if ($is_group) {
            // --- GROUP LOGIC ---
            
            // 1. Verify Sender Membership
            $mem_stmt = $pdo->prepare("SELECT status FROM group_members WHERE group_id = :gid AND user_id = :uid");
            $mem_stmt->execute([':gid' => $group_id, ':uid' => $sender_id]);
            $member_status = $mem_stmt->fetchColumn();

            if (!$member_status || $member_status !== 'active') {
                http_response_code(403);
                echo json_encode(array("message" => "You are not a member of this group."));
                exit();
            }

            // Check Send Permission
            $role_stmt = $pdo->prepare("SELECT role FROM group_members WHERE group_id = :gid AND user_id = :uid");
            $role_stmt->execute([':gid' => $group_id, ':uid' => $sender_id]);
            $sender_role = $role_stmt->fetchColumn();

            if ($sender_role !== 'owner' && $sender_role !== 'admin') {
                 $permStmt = $pdo->prepare("SELECT allow_member_send_messages FROM groups WHERE id = :gid");
                 $permStmt->execute([':gid' => $group_id]);
                 if (!$permStmt->fetchColumn()) {
                     http_response_code(403); echo json_encode(["message" => "Only admins can send messages."]); exit();
                 }
            }

            // 2. Get Conversation ID
            $conv_stmt = $pdo->prepare("SELECT id FROM conversations WHERE group_id = :gid AND is_group = 1");
            $conv_stmt->execute([':gid' => $group_id]);
            $conv_id = $conv_stmt->fetchColumn();

            if (!$conv_id) {
                 http_response_code(404);
                 echo json_encode(array("message" => "Group conversation not found."));
                 exit();
            }

            // Update last message in conversation
             $msg_content = !empty($data->message) ? $data->message : 'Media'; // Simplified for preview
             $upd_conv = $pdo->prepare("UPDATE conversations SET last_message = :msg, last_message_time = NOW() WHERE id = :cid");
             $upd_conv->execute([':msg' => $msg_content, ':cid' => $conv_id]);

        } else {
            // --- 1-ON-1 LOGIC ---
            
            // 0. Check Blocked
            $block_check = "SELECT COUNT(*) FROM relationships 
                            WHERE status = 'blocked' 
                            AND (
                                (user_id = :sid AND target_id = :rid) 
                                OR 
                                (user_id = :rid AND target_id = :sid)
                            )";
            $block_stmt = $pdo->prepare($block_check);
            $block_stmt->execute([':sid' => $sender_id, ':rid' => $receiver_id]);
            if ($block_stmt->fetchColumn() > 0) {
                http_response_code(403);
                echo json_encode(array("message" => "You cannot send messages to this user."));
                exit();
            }

            // Ensure user1 < user2
            $user1_id = min((int)$sender_id, (int)$receiver_id);
            $user2_id = max((int)$sender_id, (int)$receiver_id);

            $msg_content = !empty($data->message) ? $data->message : 'Media';

            // 1. Get or Create Conversation
            $conv_query = "INSERT INTO conversations (user1_id, user2_id, last_message, is_group) 
                           VALUES (:u1, :u2, :msg, 0) 
                           ON DUPLICATE KEY UPDATE last_message = :msg, last_message_time = CURRENT_TIMESTAMP";
            $conv_stmt = $pdo->prepare($conv_query);
            $conv_stmt->execute([':u1' => $user1_id, ':u2' => $user2_id, ':msg' => $msg_content]);

            // Get ID
            $get_conv = "SELECT id FROM conversations WHERE user1_id = :u1 AND user2_id = :u2 AND is_group = 0";
            $get_stmt = $pdo->prepare($get_conv);
            $get_stmt->execute([':u1' => $user1_id, ':u2' => $user2_id]);
            $conv_id = $get_stmt->fetchColumn();
        }

        // --- COMMON MESSAGE INSERTION ---
        
        $message_text = !empty($data->message) ? $data->message : '';
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

        $is_one_time = !empty($data->is_one_time) ? 1 : 0;
        if ($is_one_time && empty($media_url) && !empty($message_text) && mb_strlen($message_text) > 200) {
             http_response_code(400); echo json_encode(["message" => "OTV text limit 200 chars."]); exit();
        }
        $delete_after_seconds = ($is_one_time && !empty($data->delete_after_seconds)) ? (int)$data->delete_after_seconds : ($is_one_time ? 300 : 0);

        $scheduled_at = !empty($data->scheduled_at) ? $data->scheduled_at : null;
        $status = $scheduled_at ? 'scheduled' : 'sent';
        $sent_at = ($status === 'sent') ? date('Y-m-d H:i:s') : null;

        $msg_query = "INSERT INTO messages (conversation_id, sender_id, receiver_id, message_text, message_type, media_id, reply_to_message_id, is_one_time, delete_after_seconds, scheduled_at, status, sent_at) 
                      VALUES (:cid, :sid, :rid, :msg, :type, :mid, :reply_id, :is_ot, :del_sec, :sch_at, :status, :sent_at)";
        $msg_stmt = $pdo->prepare($msg_query);
        
        // --- MEDIA SEPARATION LOGIC ---
        $media_id = null;
        if (!empty($media_url)) {
            $media_stmt = $pdo->prepare("INSERT INTO media (file_path, file_type, mime_type, file_size, duration, thumbnail_url, file_name, expires_at) VALUES (:fp, :ft, :mime, :fsize, :dur, :thumb, :fname, DATE_ADD(NOW(), INTERVAL 7 DAY))");
            $media_stmt->execute([
                ':fp' => $media_url,
                ':ft' => $message_type,
                ':mime' => $mime_type,
                ':fsize' => $file_size,
                ':dur' => $duration,
                ':thumb' => $thumbnail_url,
                ':fname' => !empty($file_name) ? $file_name : basename($media_url)
            ]);
            $media_id = $pdo->lastInsertId();
        }

        if ($msg_stmt->execute([
            ':cid' => $conv_id, 
            ':sid' => $sender_id, 
            ':rid' => $receiver_id, // NULL for groups
            ':msg' => $message_text,
            ':type' => $message_type,
            ':mid' => $media_id,
            ':reply_id' => $reply_to_message_id,
            ':is_ot' => $is_one_time,
            ':del_sec' => $delete_after_seconds,
            ':sch_at' => $scheduled_at,
            ':status' => $status,
            ':sent_at' => $sent_at
        ])) {
            $message_id = $pdo->lastInsertId();

            // --- MEDIA TRACKING INITIALIZATION ---
            if ($media_id) {
                try {
                    $tracking_stmt = $pdo->prepare("INSERT INTO media_tracking (media_id, message_id, sender_id, receiver_id, status) VALUES (:mid, :msgid, :sid, :rid, 'pending')");
                    
                    if ($is_group) {
                        // Get all active group members except sender
                        $members_stmt = $pdo->prepare("SELECT user_id FROM group_members WHERE group_id = :gid AND user_id != :sid AND status = 'active'");
                        $members_stmt->execute([':gid' => $group_id, ':sid' => $sender_id]);
                        $members = $members_stmt->fetchAll(PDO::FETCH_COLUMN);
                        
                        foreach ($members as $member_id) {
                            $tracking_stmt->execute([
                                ':mid' => $media_id,
                                ':msgid' => $message_id,
                                ':sid' => $sender_id,
                                ':rid' => $member_id
                            ]);
                        }
                    } else {
                        // 1-on-1
                        $tracking_stmt->execute([
                            ':mid' => $media_id,
                            ':msgid' => $message_id,
                            ':sid' => $sender_id,
                            ':rid' => $receiver_id
                        ]);
                    }
                } catch (Exception $trackErr) {
                    error_log("Media tracking init failed: " . $trackErr->getMessage());
                    // Non-fatal for message delivery
                }
            }

            // --- NOTIFICATION LOGIC ---
            if ($status === 'sent') {
                include_once __DIR__ . '/../includes/push_service.php';

                // Get Sender Name
                $sender_stmt = $pdo->prepare("SELECT username, display_name FROM users WHERE id = :sid");
                $sender_stmt->execute([':sid' => $sender_id]);
                $sender_row = $sender_stmt->fetch(PDO::FETCH_ASSOC);
                $sender_name = !empty($sender_row['display_name']) ? $sender_row['display_name'] : $sender_row['username'];

                $body = "New secure message";
                if ($is_one_time) { $body = "New private message"; }
                elseif ($message_type != 'text') { $body = ucfirst($message_type); }

                if ($is_group) {
                    // Group Notifications
                    // Get Group Name
                    $g_stmt = $pdo->prepare("SELECT name FROM groups WHERE id = :gid");
                    $g_stmt->execute([':gid' => $group_id]);
                    $group_name = $g_stmt->fetchColumn();
                    $title = $group_name . ": " . $sender_name;

                    // ... (Mentions Logic)
                    // Extract mentions from text (server-side validation)
                    // Pattern: @username
                    $mentions = [];
                    if (preg_match_all('/@([a-zA-Z0-9_]+)/', $message_text, $matches)) {
                        $potential_usernames = array_unique($matches[1]);
                        if (!empty($potential_usernames)) {
                            // Verify these usernames exist and are in the group
                            $placeholders = str_repeat('?,', count($potential_usernames) - 1) . '?';
                            $mention_query = "
                                SELECT u.id, u.username, u.device_token 
                                FROM users u
                                JOIN group_members gm ON u.id = gm.user_id
                                WHERE gm.group_id = ? 
                                AND u.username IN ($placeholders)
                            ";
                            $params = array_merge([$group_id], $potential_usernames);
                            $mention_stmt = $pdo->prepare($mention_query);
                            $mention_stmt->execute($params);
                            $valid_mentions = $mention_stmt->fetchAll(PDO::FETCH_ASSOC);

                            // Insert into message_mentions
                            $mention_insert = $pdo->prepare("INSERT INTO message_mentions (message_id, user_id, group_id) VALUES (?, ?, ?)");
                            foreach ($valid_mentions as $vm) {
                                // Don't mention yourself
                                if ($vm['id'] == $sender_id) continue;
                                
                                $mention_insert->execute([$message_id, $vm['id'], $group_id]);
                                $mentions[$vm['id']] = true; // Mark as mentioned for notification logic
                            }
                        }
                    }

                    // Get Recipients (Active Members != Sender)
                    $recipients_query = "
                        SELECT u.id, u.device_token
                        FROM group_members gm
                        JOIN users u ON gm.user_id = u.id
                        WHERE gm.group_id = :gid 
                        AND gm.user_id != :sid 
                        AND gm.status = 'active'
                        AND u.device_token IS NOT NULL
                    ";
                    $rec_stmt = $pdo->prepare($recipients_query);
                    $rec_stmt->execute([':gid' => $group_id, ':sid' => $sender_id]);
                    $recipients = $rec_stmt->fetchAll(PDO::FETCH_ASSOC);

                    foreach ($recipients as $rec) {
                        $shouldNotify = true;
                        $isMentioned = isset($mentions[$rec['id']]);

                        // Check Mute Status
                        // Optimized: We could do this in the main query, but keeping PHP logic for now for readability of "Overriding"
                        $mute_check = $pdo->prepare("SELECT COUNT(*) FROM muted_chats WHERE user_id = :uid AND target_id = :gid AND mute_until > NOW()");
                        $mute_check->execute([':uid' => $rec['id'], ':gid' => $group_id]); 
                        $is_muted = $mute_check->fetchColumn() > 0;

                        if ($is_muted) {
                            if ($isMentioned) {
                                // OVERRIDE MUTE because user is mentioned
                                $shouldNotify = true;
                            } else {
                                $shouldNotify = false;
                            }
                        }

                        if ($shouldNotify) {
                            $payload = [
                                'type' => 'new_group_message', // Distinct type
                                'conversation_id' => $conv_id,
                                'group_id' => $group_id,
                                'sender_id' => $sender_id,
                                'sender_name' => $sender_name,
                                'group_name' => $group_name,
                                'message_id' => $message_id,
                                'is_mention' => $isMentioned // Flag for client
                            ];
                            
                            // Custom body for mentions
                            $notificationBody = $body;
                            if ($isMentioned) {
                                $notificationBody = "You were mentioned: " . $body;
                            }

                            sendPushNotification($rec['device_token'], $title, $notificationBody, $payload);
                        }
                    }

                } else {
                    // 1-on-1 Notifications
                    // ... (Existing Logic)
                    // Check Mute
                    $notif_query = "SELECT u.device_token, (SELECT COUNT(*) FROM muted_chats WHERE user_id = :rid AND target_id = :sid AND mute_until > NOW()) as is_muted FROM users u WHERE u.id = :rid";
                    $notif_stmt = $pdo->prepare($notif_query);
                    $notif_stmt->execute([':rid' => $receiver_id, ':sid' => $sender_id]);
                    $receiver_info = $notif_stmt->fetch(PDO::FETCH_ASSOC);

                    if ($receiver_info && !empty($receiver_info['device_token']) && $receiver_info['is_muted'] == 0) {
                        $title = $sender_name;
                        $payload = [
                            'type' => 'new_message',
                            'conversation_id' => $conv_id,
                            'sender_id' => $sender_id, // For navigation to profile/chat
                            'sender_name' => $sender_name,
                            'message_id' => $message_id
                        ];
                        sendPushNotification($receiver_info['device_token'], $title, $body, $payload);
                    }
                }
            }

            http_response_code(200);
            echo json_encode(array("message" => "Message sent.", "conversation_id" => $conv_id));
        } else {
            http_response_code(503); echo json_encode(array("message" => "Unable to send message."));
        }

    } catch (PDOException $e) {
        http_response_code(500); echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400); echo json_encode(array("message" => "Incomplete data."));
}
