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
