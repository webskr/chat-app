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

if (!empty($data->user_id) && !empty($data->target_id) && !empty($data->action)) {
    try {
        $user_id = $data->user_id;
        $target_id = $data->target_id;
        $action = $data->action; // 'friend', 'unfriend', 'block', 'unblock'

        if ($action == 'friend') {
            // Send friend request
            $query = "INSERT INTO relationships (user_id, target_id, status) VALUES (:uid, :tid, 'pending') 
                      ON DUPLICATE KEY UPDATE status = 'pending'";
        } elseif ($action == 'accept') {
            // Accept friend request
            // We need to update the status to accepted where target_id is the one accepting
            $query = "UPDATE relationships SET status = 'accepted' WHERE user_id = :tid AND target_id = :uid";
        } elseif ($action == 'block') {
            $query = "INSERT INTO relationships (user_id, target_id, status) VALUES (:uid, :tid, 'blocked') 
                      ON DUPLICATE KEY UPDATE status = 'blocked'";
        } elseif ($action == 'unfriend' || $action == 'unblock' || $action == 'decline') {
            // For decline, we delete the request
            // For unfriend/unblock, we delete the relationship
            
            if ($action == 'unfriend') {
                // Cascading Deletion for Unfriend
                // 1. Get Conversation ID
                $conv_stmt = $pdo->prepare("SELECT id FROM conversations WHERE (user1_id = :uid AND user2_id = :tid) OR (user1_id = :tid AND user2_id = :uid)");
                $conv_stmt->execute([':uid' => $user_id, ':tid' => $target_id]);
                $conversation_id = $conv_stmt->fetchColumn();

                if ($conversation_id) {
                    // 2. Fetch all media files to delete
                    $media_stmt = $pdo->prepare("SELECT media_url, thumbnail_url, file_name FROM messages WHERE conversation_id = :cid AND (media_url IS NOT NULL OR thumbnail_url IS NOT NULL)");
                    $media_stmt->execute([':cid' => $conversation_id]);
                    $media_files = $media_stmt->fetchAll(PDO::FETCH_ASSOC);

                    // 3. Delete files from server
                    foreach ($media_files as $file) {
                        // Assuming URLs are relative to domain root, need to resolve to file system path
                        // API_URL might be http://localhost/chat-app/backend
                        // File paths in DB might be 'uploads/images/...'
                        // We need to map this to c:\xampp\htdocs\chat-app\backend\uploads\...
                        
                        $base_dir = __DIR__ . '/../'; // Pointing to backend root

                        if (!empty($file['media_url'])) {
                            $file_path = $base_dir . $file['media_url'];
                            if (file_exists($file_path)) {
                                unlink($file_path);
                            }
                        }
                        if (!empty($file['thumbnail_url'])) {
                            $thumb_path = $base_dir . $file['thumbnail_url'];
                            if (file_exists($thumb_path)) {
                                unlink($thumb_path);
                            }
                        }
                    }

                    // 4. Delete Messages (Cascade should handle this if defined in DB, but explicit is safer here if not)
                    $del_msg_stmt = $pdo->prepare("DELETE FROM messages WHERE conversation_id = :cid");
                    $del_msg_stmt->execute([':cid' => $conversation_id]);

                    // 5. Delete Conversation
                    $del_conv_stmt = $pdo->prepare("DELETE FROM conversations WHERE id = :cid");
                    $del_conv_stmt->execute([':cid' => $conversation_id]);
                }
            }

            $query = "DELETE FROM relationships WHERE (user_id = :uid AND target_id = :tid) OR (user_id = :tid AND target_id = :uid)";
        } else {
            http_response_code(400);
            echo json_encode(array("message" => "Invalid action."));
            exit();
        }

        $stmt = $pdo->prepare($query);
        $stmt->bindParam(':uid', $user_id);
        $stmt->bindParam(':tid', $target_id);

        if ($stmt->execute()) {
            // --- Push Notification Logic ---
            include_once '../includes/push_service.php';
            
            // Get Sender Name
            $sender_name_query = "SELECT display_name FROM users WHERE id = :uid";
            $sender_stmt = $pdo->prepare($sender_name_query);
            $sender_stmt->execute([':uid' => $user_id]);
            $sender_name = $sender_stmt->fetchColumn();

            if ($action == 'friend') {
                // Notify Target about Friend Request
                $target_query = "SELECT device_token FROM users WHERE id = :tid";
                $target_stmt = $pdo->prepare($target_query);
                $target_stmt->execute([':tid' => $target_id]);
                $target_token = $target_stmt->fetchColumn();

                if ($target_token) {
                    sendPushNotification(
                        $target_token, 
                        "New Friend Request", 
                        "$sender_name sent you a friend request.", 
                        ['type' => 'friend_request', 'sender_id' => $user_id]
                    );
                }
            } elseif ($action == 'accept') {
                // Notify Original Sender (uid in this context is the ONE ACCEPTING, so we notify target_id which is the ORIGINAL REQUESTER?? No wait.)
                // Query says: UPDATE relationships ... WHERE user_id = :tid AND target_id = :uid
                // So :tid is the Original Requester. :uid is the Acceptee.
                // We want to notify :tid that :uid accepted.
                
                $original_requester_query = "SELECT device_token FROM users WHERE id = :tid";
                $req_stmt = $pdo->prepare($original_requester_query);
                $req_stmt->execute([':tid' => $target_id]);
                $requester_token = $req_stmt->fetchColumn();

                if ($requester_token) {
                    sendPushNotification(
                        $requester_token,
                        "Request Accepted",
                        "$sender_name accepted your friend request.",
                        ['type' => 'request_accepted', 'user_id' => $user_id]
                    );
                }
            }
            // --- End Push Notification Logic ---

            http_response_code(200);
            echo json_encode(array("message" => "Relationship updated successfully."));
        } else {
            http_response_code(500);
            echo json_encode(array("message" => "Unable to update relationship."));
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
