<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// Debug Logging Function
function logDebug($message) {
    file_put_contents('broadcast_debug.log', date('Y-m-d H:i:s') . " - " . $message . "\n", FILE_APPEND);
}

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../includes/db_connection.php';

// Prevent Timeout for large user bases
set_time_limit(0);
ignore_user_abort(true);

$data = json_decode(file_get_contents("php://input"));

logDebug("Received broadcast request. Data: " . print_r($data, true));

logDebug("Sender: " . ($data->sender_id ?? 'null'));

if (!empty($data->sender_id) && (!empty($data->message) || !empty($data->image_path))) {
    try {
        // 1. Verify Sender is Official
        $stmt = $pdo->prepare("SELECT is_official FROM users WHERE id = :id");
        $stmt->execute([':id' => $data->sender_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || $user['is_official'] != 1) {
            logDebug("Unauthorized attempt by user ID: " . $data->sender_id);
            http_response_code(403);
            echo json_encode(array("message" => "Unauthorized. Only official accounts can send broadcasts."));
            exit();
        }

        // 2. Get All Users (excluding sender)
        $usersStmt = $pdo->prepare("SELECT id FROM users WHERE id != :id");
        $usersStmt->execute([':id' => $data->sender_id]);
        $allUsers = $usersStmt->fetchAll(PDO::FETCH_COLUMN);

        logDebug("Found " . count($allUsers) . " users to broadcast to.");

        if (empty($allUsers)) {
             echo json_encode(array("message" => "No users to broadcast to."));
             exit();
        }

        // 3. Prepare Common Data
        $message_text = $data->message ?? ''; // Handle potentially empty message if image only
        $image_path = !empty($data->image_path) ? $data->image_path : null;
        
        logDebug("Message: $message_text | Image Path: $image_path");
        
        // Date Handling: Input is ISO 8601 (UTC). We want to store UTC DATETIME.
        $scheduled_at = null;
        if (!empty($data->scheduled_at)) {
             $ts = strtotime($data->scheduled_at);
             $scheduled_at = gmdate('Y-m-d H:i:s', $ts);
             logDebug("Scheduled At (ISO): " . $data->scheduled_at . " -> (UTC DB): " . $scheduled_at);
        }

        $status = $scheduled_at ? 'scheduled' : 'sent';
        // If sent immediately, use UTC timestamp for sent_at too
        $sent_at = ($status === 'sent') ? gmdate('Y-m-d H:i:s') : null;
        
        $message_type = 'text';
        $media_url = null;
        
        if ($image_path) {
            $message_type = 'image';
            $media_url = $image_path;
        }

        // 4. Send Message Loop
        $pdo->beginTransaction();

        // --- MEDIA SEPARATION LOGIC ---
        $media_id = null;
        if (!empty($media_url)) {
            $media_stmt = $pdo->prepare("INSERT INTO media (file_path, file_type, mime_type, file_name) VALUES (:fp, :ft, :mime, :fname)");
            $media_stmt->execute([
                ':fp' => $media_url,
                ':ft' => $message_type,
                ':mime' => 'image/jpeg', // Defaulting to generic image for broadcast if unknown
                ':fname' => basename($media_url)
            ]);
            $media_id = $pdo->lastInsertId();
        }

        $msgSql = "INSERT INTO messages (conversation_id, sender_id, receiver_id, message_text, message_type, media_id, scheduled_at, status, sent_at) 
                   VALUES (:cid, :sid, :rid, :msg, :type, :mid, :sch_at, :status, :sent_at)";
        $msgStmt = $pdo->prepare($msgSql);

        $convSql = "INSERT INTO conversations (user1_id, user2_id, last_message, last_message_time) 
                    VALUES (:u1, :u2, :msg, NOW()) 
                    ON DUPLICATE KEY UPDATE last_message = :msg, last_message_time = NOW()";
        $convStmt = $pdo->prepare($convSql);
        
        // Push notification preparation
        include_once '../includes/fcm_service.php';
        $push_title = "Vegarm Official";
        $push_body = $message_type === 'image' ? "📷 New Announcement" : (mb_substr($message_text, 0, 40) . "...");

        $successCount = 0;
        
        // Prepare token statement once - Only for users with notifications enabled
        $tokenStmt = $pdo->prepare("
            SELECT d.fcm_token, u.hide_notification_message, u.hide_notification_name
            FROM user_devices d 
            JOIN users u ON d.user_id = u.id 
            WHERE d.user_id = :id 
            AND d.fcm_token IS NOT NULL 
            AND u.notifications_enabled = 1
        ");

        foreach ($allUsers as $receiver_id) {
            $user1_id = min((int)$data->sender_id, (int)$receiver_id);
            $user2_id = max((int)$data->sender_id, (int)$receiver_id);

            // Create/Update Conversation
            // We use message_text for last_message. If empty (image only), say 'Sent an image'
            $lastMsgPreview = $message_text ?: '📷 Image';
            $convStmt->execute([':u1' => $user1_id, ':u2' => $user2_id, ':msg' => $lastMsgPreview]);
            
            // Get Conversation ID
            $getConvStmt = $pdo->prepare("SELECT id FROM conversations WHERE user1_id = :u1 AND user2_id = :u2");
            $getConvStmt->execute([':u1' => $user1_id, ':u2' => $user2_id]);
            $convId = $getConvStmt->fetchColumn();

            if (!$convId) {
                logDebug("Failed to get convId for users $user1_id, $user2_id");
                continue; 
            }

            // Insert Message
            $msgStmt->execute([
                ':cid' => $convId,
                ':sid' => $data->sender_id,
                ':rid' => $receiver_id,
                ':msg' => $message_text,
                ':type' => $message_type,
                ':mid' => $media_id,
                ':sch_at' => $scheduled_at,
                ':status' => $status,
                ':sent_at' => $sent_at
            ]);
            
            $successCount++;

            // Push Notification (only if sent immediately)
            if ($status === 'sent') {
                 $tokenStmt->execute([':id' => $receiver_id]);
                 $tokens = $tokenStmt->fetchAll(PDO::FETCH_ASSOC);
                 
                  foreach ($tokens as $row) {
                     if ($row['fcm_token']) {
                         try {
                              $title = $row['hide_notification_name'] == 1 ? "Vegarm Official" : $push_title;
                              $body = $row['hide_notification_message'] == 1 ? "New Notification" : $push_body;

                              sendFCMNotification($row['fcm_token'], $title, $body, [
                                  'type' => 'new_message',
                                  'conversation_id' => $convId,
                                  'sender_id' => $data->sender_id
                              ]);
                         } catch (Exception $e) {}
                     }
                  }
            }
        }

        $pdo->commit();
        logDebug("Broadcast completed. Success count: $successCount");
        echo json_encode(array("message" => "Broadcast sent successfully to " . $successCount . " users."));

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        logDebug("Exception: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(array("message" => "Error sending broadcast: " . $e->getMessage()));
    }
} else {
    logDebug("Incomplete data provided. SenderID: " . ($data->sender_id ?? 'missing') . ", Msg/Img missing");
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data " . json_encode($data)));
}
?>
