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

if (!empty($data->email) && !empty($data->password)) {
    $email = trim($data->email);
    $password = $data->password;

    try {
        $query = "SELECT id, username, display_name, email, password, avatar_id, bio, username_last_updated, global_auto_delete_minutes, last_seen, privacy_last_seen, privacy_read_receipts, privacy_profile_visibility, show_in_world, neon_color, is_official FROM users WHERE email = :email OR username = :username LIMIT 0,1";
        $stmt = $pdo->prepare($query);

        $stmt->bindParam(':email', $email);
        $stmt->bindParam(':username', $email); // Bind the same input to username parameter
        $stmt->execute();
        $num = $stmt->rowCount();

        if ($num > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $id = $row['id'];
            $username = $row['username'];
            $display_name = $row['display_name'];
            $email = $row['email'];
            $password_hash = $row['password'];
            $avatar_id = $row['avatar_id'];
            $bio = $row['bio'];
            $username_last_updated = $row['username_last_updated'];

            if (password_verify($password, $password_hash)) {
                http_response_code(200);
                ob_clean();
                echo json_encode(array(
                    "message" => "Login successful.",
                    "user" => array(
                        "id" => $id,
                        "username" => $username,
                        "display_name" => $display_name,
                        "email" => $email,
                        "avatar_id" => $avatar_id,
                        "bio" => $bio,
                        "username_last_updated" => $username_last_updated,
                        "global_auto_delete_minutes" => $row['global_auto_delete_minutes'],
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
                http_response_code(401);
                echo json_encode(array("message" => "Login failed. Invalid password."));
            }
        } else {
            http_response_code(404);
            echo json_encode(array("message" => "Login failed. User not found."));
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Login failed. Data is incomplete."));
}
