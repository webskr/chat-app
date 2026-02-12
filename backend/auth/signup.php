<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../includes/db_connection.php';


$data = json_decode(file_get_contents("php://input"));

if (!empty($data->username) && !empty($data->email) && !empty($data->password)) {
    $username = trim($data->username);
    $email = trim($data->email);
    $password = $data->password;

    try {
        $avatar_id = (string)rand(0, 5);
        $invite_code = !empty($data->invite_code) ? trim($data->invite_code) : null;
        $inviter_id = null;

        // 1. Validate invite code if provided
        if ($invite_code) {
            $inv_stmt = $pdo->prepare("SELECT id, inviter_user_id, used_count, max_uses, expires_at FROM invites WHERE invite_code = :code AND is_active = 1");
            $inv_stmt->execute([':code' => $invite_code]);
            $invite = $inv_stmt->fetch();

            if ($invite) {
                // Check expiry and limits
                $is_expired = $invite['expires_at'] && strtotime($invite['expires_at']) < time();
                $is_full = $invite['max_uses'] && $invite['used_count'] >= $invite['max_uses'];

                if (!$is_expired && !$is_full) {
                    $inviter_id = $invite['inviter_user_id'];
                    $invite_id = $invite['id'];
                }
            }
        }
        
        // Random Neon Color Generator for default appearance
        $neon_colors = [
            '#FF00FF', '#00FFFF', '#39FF14', '#FFE700', '#FF10F0', '#BF00FF', '#FF3131', '#1F51FF', '#FF5F1F',
        ];
        $random_color = $neon_colors[array_rand($neon_colors)];

        $pdo->beginTransaction();

        $query = "INSERT INTO users (username, email, password, avatar_id, border_color, button_color) VALUES (:username, :email, :password, :avatar_id, :border_color, :button_color)";
        $stmt = $pdo->prepare($query);

        $password_hash = password_hash($password, PASSWORD_BCRYPT);

        $stmt->bindParam(':username', $username);
        $stmt->bindParam(':email', $email);
        $stmt->bindParam(':password', $password_hash);
        $stmt->bindParam(':avatar_id', $avatar_id);
        $stmt->bindParam(':border_color', $random_color);
        $stmt->bindParam(':button_color', $random_color);

        if ($stmt->execute()) {
            $new_user_id = $pdo->lastInsertId();

            // 2. Auto-friend logic
            if ($inviter_id) {
                // Add bidirectional accepted relationship
                $rel_query = "INSERT INTO relationships (user_id, target_id, status) VALUES (:uid, :tid, 'accepted'), (:tid, :uid, 'accepted') 
                              ON DUPLICATE KEY UPDATE status = 'accepted'";
                $rel_stmt = $pdo->prepare($rel_query);
                $rel_stmt->execute([':uid' => $inviter_id, ':tid' => $new_user_id]);

                // Update invite stats
                $upd_inv = $pdo->prepare("UPDATE invites SET used_count = used_count + 1 WHERE id = :id");
                $upd_inv->execute([':id' => $invite_id]);

                // Log use
                $log_use = $pdo->prepare("INSERT INTO invite_uses (invite_id, invited_user_id) VALUES (:iid, :uid)");
                $log_use->execute([':iid' => $invite_id, ':uid' => $new_user_id]);
            }

            $pdo->commit();
            http_response_code(201);
            echo json_encode(array("message" => "User was created."));
        } else {
            $pdo->rollBack();
            http_response_code(503);
            echo json_encode(array("message" => "Unable to create user."));
        }
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Unable to create user. Data is incomplete."));
}
