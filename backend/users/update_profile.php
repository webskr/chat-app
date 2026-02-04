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

if (!empty($data->id) && (!empty($data->username) || !empty($data->avatar_id))) {
    try {
        // Validate Username Uniqueness & Time Restriction if username is changing
        if (!empty($data->username)) {
            $stmt = $pdo->prepare("SELECT username, username_last_updated FROM users WHERE id = :id");
            $stmt->execute([':id' => $data->id]);
            $currentUser = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($currentUser && $currentUser['username'] !== $data->username) {
                // Check 15-day limit
                if ($currentUser['username_last_updated']) {
                    $lastUpdated = new DateTime($currentUser['username_last_updated']);
                    $now = new DateTime();
                    $interval = $lastUpdated->diff($now);
                    
                    if ($interval->days < 15) {
                        http_response_code(400);
                        echo json_encode(array("message" => "Username can only be changed once every 15 days. Days remaining: " . (15 - $interval->days)));
                        exit();
                    }
                }

                // Check Uniqueness
                $checkStmt = $pdo->prepare("SELECT id FROM users WHERE username = :username AND id != :id");
                $checkStmt->execute([':username' => $data->username, ':id' => $data->id]);
                if ($checkStmt->rowCount() > 0) {
                    http_response_code(400);
                    echo json_encode(array("message" => "Username already taken."));
                    exit();
                }
            }
        }

        $update_fields = [];
        $params = [':id' => $data->id];

        if (!empty($data->username)) {
            // Only update if changed
            $stmt = $pdo->prepare("SELECT username FROM users WHERE id = :id");
            $stmt->execute([':id' => $data->id]);
            $current = $stmt->fetchColumn();
            
            if ($current !== $data->username) {
                $update_fields[] = "username = :username";
                $update_fields[] = "username_last_updated = NOW()";
                $params[':username'] = trim($data->username);
            }
        }

        if (isset($data->display_name)) { // Allow empty string to clear
            $update_fields[] = "display_name = :display_name";
            $params[':display_name'] = trim($data->display_name);
        }

        if (isset($data->bio)) { // Allow empty string to clear
            $update_fields[] = "bio = :bio";
            $params[':bio'] = trim($data->bio);
        }

        if (!empty($data->avatar_id)) {
            $update_fields[] = "avatar_id = :avatar_id";
            $params[':avatar_id'] = $data->avatar_id;
        }

        if (empty($update_fields)) {
            http_response_code(200);
            echo json_encode(array("message" => "No changes made."));
            exit();
        }

        $query = "UPDATE users SET " . implode(", ", $update_fields) . " WHERE id = :id";
        $stmt = $pdo->prepare($query);

        if ($stmt->execute($params)) {
            // Fetch updated user data to return
            $fetchStmt = $pdo->prepare("SELECT id, username, display_name, bio, avatar_id, username_last_updated FROM users WHERE id = :id");
            $fetchStmt->execute([':id' => $data->id]);
            $updatedUser = $fetchStmt->fetch(PDO::FETCH_ASSOC);

            http_response_code(200);
            echo json_encode(array(
                "message" => "Profile updated successfully.",
                "user" => $updatedUser
            ));
        } else {
            http_response_code(503);
            echo json_encode(array("message" => "Unable to update profile."));
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data."));
}
