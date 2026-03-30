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
require_once '../api/utils/rateLimiter.php';
require_once '../includes/jwt_helper.php';
include_once '../includes/firebase_auth.php';

$ip = $_SERVER['REMOTE_ADDR'];
checkRateLimit($pdo, $ip, "login", 10, 60);

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->firebase_token)) {
    try {
        // 1. Verify the Firebase Token
        $token = verifyFirebaseToken($data->firebase_token);
        $email = $token->claims()->get('email');

        if (!$email) {
            http_response_code(400);
            echo json_encode(array("message" => "Firebase token is missing email claim."));
            exit();
        }

        // 2. Fetch User Details from MySQL
        $query = "SELECT id, username, display_name, email, avatar_id, bio, username_last_updated, country, state, district, global_auto_delete_minutes, global_auto_delete_individual, global_auto_delete_group, last_seen, privacy_last_seen, privacy_read_receipts, privacy_profile_visibility, show_in_world, neon_color, is_official FROM users WHERE email = :email LIMIT 1";
        $stmt = $pdo->prepare($query);
        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            // Success: Generate local tokens
            $access_token = JWTHelper::generateAccessToken($row['id']);
            $refresh_token = JWTHelper::generateRefreshToken();
            $refresh_token_hash = password_hash($refresh_token, PASSWORD_DEFAULT);
            $expiry = date('Y-m-d H:i:s', time() + 30 * 24 * 60 * 60); // 30 days

            // Store Refresh Token
            $refresh_stmt = $pdo->prepare("INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_info) VALUES (:user_id, :token_hash, :expires_at, :device_info)");
            $refresh_stmt->execute([
                ':user_id' => $row['id'],
                ':token_hash' => $refresh_token_hash,
                ':expires_at' => $expiry,
                ':device_info' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'
            ]);
            
            $refresh_id = $pdo->lastInsertId();
            $final_refresh_token = $refresh_id . '|' . $refresh_token;

            http_response_code(200);
            ob_clean();
            echo json_encode(array(
                "message" => "Login successful.",
                "access_token" => $access_token,
                "refresh_token" => $final_refresh_token,
                "expires_in" => JWTHelper::getAccessTokenExpiry(),
                "user" => array(
                    "id" => $row['id'],
                    "username" => $row['username'],
                    "display_name" => $row['display_name'],
                    "email" => $row['email'],
                    "avatar_id" => $row['avatar_id'],
                    "bio" => $row['bio'],
                    "username_last_updated" => $row['username_last_updated'],
                    "country" => $row['country'],
                    "state" => $row['state'],
                    "district" => $row['district'],
                    "global_auto_delete_minutes" => $row['global_auto_delete_minutes'],
                    "global_auto_delete_individual" => $row['global_auto_delete_individual'] ?? 1,
                    "global_auto_delete_group" => $row['global_auto_delete_group'] ?? 0,
                    "last_seen" => $row['last_seen'],
                    "privacy_last_seen" => $row['privacy_last_seen'],
                    "privacy_read_receipts" => $row['privacy_read_receipts'],
                    "privacy_profile_visibility" => $row['privacy_profile_visibility'],
                    "show_in_world" => $row['show_in_world'],
                    "neon_color" => $row['neon_color'],
                    "is_official" => $row['is_official']
                )
            ));
        } else {
            http_response_code(404);
            echo json_encode(array("message" => "Firebase account verified, but no local Vergram account found. Please sign up."));
        }
    } catch (Exception $e) {
        http_response_code(401);
        echo json_encode(array("message" => "Authentication failed: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Firebase token is required."));
}


