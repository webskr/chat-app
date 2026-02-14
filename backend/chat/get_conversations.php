<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../includes/db_connection.php';

$user_id = isset($_GET['user_id']) ? $_GET['user_id'] : null;

if (!empty($user_id)) {
    try {
        // Proactive Delivery: Mark all messages sent TO me as 'delivered'
        // Since I'm fetching my conversation list, I'm online and receiving data.
        $deliveryQuery = "UPDATE messages 
                          SET status = 'delivered', 
                              delivered_at = NOW() 
                          WHERE receiver_id = :me 
                          AND status = 'sent'";
        $deliveryStmt = $pdo->prepare($deliveryQuery);
        $deliveryStmt->execute([':me' => $user_id]);

        $query = "SELECT c.id, 
                         CASE 
                            WHEN (c.user1_id = :me_check1 AND c.last_message_time <= c.user1_cleared_at) THEN NULL
                            WHEN (c.user2_id = :me_check2 AND c.last_message_time <= c.user2_cleared_at) THEN NULL
                            ELSE c.last_message 
                         END as last_message,
                         c.last_message_time, 
                         u.id as other_user_id, u.username as other_username, u.avatar_id as other_avatar_id, u.avatar_url as other_avatar_url,
                         u.last_seen, u.privacy_last_seen, u.privacy_profile_visibility
                  FROM conversations c
                  JOIN users u ON (c.user1_id = u.id OR c.user2_id = u.id)
                  WHERE (c.user1_id = :uid1 OR c.user2_id = :uid2) 
                  AND ( (c.user1_id != c.user2_id AND u.id != :uid3) OR (c.user1_id = c.user2_id AND u.id = :uid4) )
                  AND u.id NOT IN (SELECT target_id FROM relationships WHERE user_id = :uid5 AND status = 'blocked')
                  ORDER BY c.last_message_time DESC";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([
            ':uid1' => $user_id, 
            ':uid2' => $user_id, 
            ':uid3' => $user_id, 
            ':uid4' => $user_id, 
            ':uid5' => $user_id,
            ':me_check1' => $user_id,
            ':me_check2' => $user_id
        ]);
        
        $conversations = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch my privacy settings for mutual last_seen
        $myPrivacySql = "SELECT privacy_last_seen FROM users WHERE id = :id";
        $myPrivacyStmt = $pdo->prepare($myPrivacySql);
        $myPrivacyStmt->execute([':id' => $user_id]);
        $myPrivacy = $myPrivacyStmt->fetch(PDO::FETCH_ASSOC);
        $iCanSeeLastSeen = $myPrivacy ? (bool)$myPrivacy['privacy_last_seen'] : true;

        foreach ($conversations as &$conv) {
            if (!$iCanSeeLastSeen || (isset($conv['privacy_last_seen']) && $conv['privacy_last_seen'] == 0)) {
                $conv['last_seen'] = null;
            }

            // Calculate is_online
            $conv['is_online'] = false;
            if (!empty($conv['last_seen'])) {
                $last_seen_ts = strtotime($conv['last_seen']);
                if ((time() - $last_seen_ts) <= 120) {
                    $conv['is_online'] = true;
                }
            }
        }
        
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
