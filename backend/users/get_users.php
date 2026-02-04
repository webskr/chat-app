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

try {
    $query = "SELECT u.id, u.username, u.display_name, u.scramble_name, u.email, u.avatar_id, u.bio, u.username_last_updated, u.created_at, 
              (SELECT status FROM relationships WHERE user_id = :uid1 AND target_id = u.id) as relationship_status
              FROM users u WHERE u.id != :uid2 ORDER BY u.display_name ASC, u.username ASC";
    $stmt = $pdo->prepare($query);
    $stmt->execute([':uid1' => $user_id, ':uid2' => $user_id]);
    
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Filter and process users
    foreach ($users as &$user) {
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
    }
    unset($user); // Break reference
    
    http_response_code(200);
    echo json_encode($users);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
