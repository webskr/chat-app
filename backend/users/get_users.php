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

if (!$user_id) {
    http_response_code(400);
    echo json_encode(array("message" => "User ID is required."));
    exit();
}

try {
    // Fetch my privacy settings
    $myPrivacySql = "SELECT privacy_last_seen FROM users WHERE id = :id";
    $myPrivacyStmt = $pdo->prepare($myPrivacySql);
    $myPrivacyStmt->execute([':id' => $user_id]);
    $myPrivacy = $myPrivacyStmt->fetch(PDO::FETCH_ASSOC);
    $iCanSeeLastSeen = $myPrivacy ? (bool)$myPrivacy['privacy_last_seen'] : true;

     $query = "SELECT u.id, u.username, u.display_name, u.scramble_name, u.email, u.avatar_id, u.avatar_url, u.bio, 
                     u.links,
                     u.last_seen, u.privacy_last_seen, u.privacy_profile_visibility, u.show_in_world, u.neon_color, u.border_color, u.button_color, u.is_official,
              (SELECT status FROM relationships WHERE user_id = :uid1 AND target_id = u.id) as sent_status,
              (SELECT status FROM relationships WHERE user_id = u.id AND target_id = :uid2) as received_status
              FROM users u WHERE u.id != :uid3 ORDER BY u.display_name ASC, u.username ASC";
    $stmt = $pdo->prepare($query);
    $stmt->execute([':uid1' => $user_id, ':uid2' => $user_id, ':uid3' => $user_id]);
    
    $all_users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $users = [];

    // Filter and process users
    foreach ($all_users as $user) {
        // Determine relationship status
        $status = 'none';
        if ($user['sent_status'] === 'accepted' || $user['received_status'] === 'accepted') {
            $status = 'accepted';
        } elseif ($user['sent_status'] === 'pending') {
            $status = 'pending'; // I sent request
        } elseif ($user['received_status'] === 'pending') {
            $status = 'request_received';
        } elseif ($user['sent_status'] === 'blocked') {
            $status = 'blocked';
        }
        $user['relationship_status'] = $status;
        // Privacy: If show_in_world is 0, only include if there is a relationship (friend or pending)
        if (isset($user['show_in_world']) && $user['show_in_world'] == 0 && empty($user['relationship_status'])) {
            continue;
        }
        // Last Seen Privacy Rules:
        // 1. If I have mine OFF, I see no one's last seen.
        // 2. If they have theirs OFF, I don't see theirs.
        if (!$iCanSeeLastSeen || (isset($user['privacy_last_seen']) && $user['privacy_last_seen'] == 0)) {
            $user['last_seen'] = null;
        }

        // Calculate is_online
        $user['is_online'] = false;
        if (!empty($user['last_seen'])) {
            $last_seen_ts = strtotime($user['last_seen']);
            // Consider online if seen in last 2 minutes (120 seconds) for better accuracy given the 3s update interval
            if ((time() - $last_seen_ts) <= 120) {
                $user['is_online'] = true;
            }
        }

        // Profile Visibility Privacy Rules:
        // If private, only friends (accepted) can see bio. 
        // UPDATED: Avatars are now ALWAYS visible per user request.
        if (isset($user['privacy_profile_visibility']) && $user['privacy_profile_visibility'] === 'private' && $user['relationship_status'] !== 'accepted') {
            $user['bio'] = null;
            // $user['avatar_id'] = 'default'; // Custom: Always show avatar
            // $user['avatar_url'] = null;     // Custom: Always show avatar
        }

        // Check if scrambling is needed
        // If scramble_name is true (1) AND relationship is NOT accepted (friend)
        if (!empty($user['scramble_name']) && $user['relationship_status'] !== 'accepted') {
            
            // Scramble display_name
            if (!empty($user['display_name'])) {
                $original = $user['display_name'];
                if (strlen($original) > 1) {
                    $arr = str_split($original);
                    shuffle($arr);
                    $scrambled = implode('', $arr);
                    // Ensure it's different if possible (simple check)
                    if ($scrambled === $original) {
                        shuffle($arr);
                        $scrambled = implode('', $arr);
                    }
                    $user['display_name'] = $scrambled;
                }
            }

            // Scramble username
            if (!empty($user['username'])) {
                $original = $user['username'];
                if (strlen($original) > 1) {
                    $arr = str_split($original);
                    shuffle($arr);
                    $scrambled = implode('', $arr);
                     if ($scrambled === $original) {
                        shuffle($arr);
                        $scrambled = implode('', $arr);
                    }
                    $user['username'] = $scrambled;
                }
            }
        }
        
        // ADDED: Push the processed user to the results array
        $users[] = $user;
    }
    unset($user); // Break reference
    
    http_response_code(200);
    echo json_encode($users);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
