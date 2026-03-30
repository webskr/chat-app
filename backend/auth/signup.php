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
include_once '../includes/firebase_auth.php';

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->username) && !empty($data->firebase_token)) {
    $username = trim($data->username);
    
    try {
        // 1. Verify the Firebase Token
        $token = verifyFirebaseToken($data->firebase_token);
        $email = $token->claims()->get('email');

        if (!$email) {
            http_response_code(400);
            echo json_encode(array("message" => "Firebase token is missing email claim."));
            exit();
        }

        // 2. Email Domain Validation
        $allowed_domains = ['gmail.com', 'outlook.com'];
        $email_parts = explode('@', $email);
        $domain = end($email_parts);

        if (!in_array(strtolower($domain), $allowed_domains)) {
            http_response_code(400);
            echo json_encode(array("message" => "Registration is only allowed for @gmail.com and @outlook.com addresses."));
            exit();
        }

        // 3. Username / Email Already Exists Check
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = :email OR username = :username LIMIT 1");
        $stmt->execute([':email' => $email, ':username' => $username]);
        if ($stmt->fetch()) {
            http_response_code(409);
            echo json_encode(array("message" => "Username or Email already exists."));
            exit();
        }


        $avatar_id = (string)rand(0, 5);
        $invite_code = !empty($data->invite_code) ? trim($data->invite_code) : null;
        $inviter_id = null;
        $invite_id = null;

        // 4. Validate invite code if provided
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
        
        // Random Neon Color Generator
        $neon_colors = ['#FF00FF', '#00FFFF', '#39FF14', '#FFE700', '#FF10F0', '#BF00FF', '#FF3131', '#1F51FF', '#FF5F1F'];
        $random_color = $neon_colors[array_rand($neon_colors)];

        $pdo->beginTransaction();

        $placeholder_password = password_hash(bin2hex(random_bytes(32)), PASSWORD_BCRYPT);
        $query = "INSERT INTO users (username, email, password, avatar_id, border_color, button_color) VALUES (:username, :email, :password, :avatar_id, :border_color, :button_color)";
        $stmt = $pdo->prepare($query);
        $stmt->execute([
            ':username' => $username,
            ':email' => $email,
            ':password' => $placeholder_password,
            ':avatar_id' => $avatar_id,
            ':border_color' => $random_color,
            ':button_color' => $random_color
        ]);

        $new_user_id = $pdo->lastInsertId();

        // 5. Auto-friend logic
        if ($inviter_id) {
            $rel_query = "INSERT INTO relationships (user_id, target_id, status) VALUES (:uid, :tid, 'accepted'), (:tid, :uid, 'accepted') ON DUPLICATE KEY UPDATE status = 'accepted'";
            $rel_stmt = $pdo->prepare($rel_query);
            $rel_stmt->execute([':uid' => $inviter_id, ':tid' => $new_user_id]);
            
            $upd_inv = $pdo->prepare("UPDATE invites SET used_count = used_count + 1 WHERE id = :id");
            $upd_inv->execute([':id' => $invite_id]);
        }

        $pdo->commit();
        http_response_code(201);
        echo json_encode(array("message" => "User was created."));
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(401);
        echo json_encode(array("message" => "Authentication failed: " . $e->getMessage()));
    }
} else {

    http_response_code(400);
    echo json_encode(array("message" => "Unable to create user. Data is incomplete."));
}


