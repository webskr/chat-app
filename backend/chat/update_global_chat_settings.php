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

if (!empty($data->user_id) && (
    isset($data->auto_delete_minutes) || 
    isset($data->scramble_name) || 
    isset($data->privacy_last_seen) || 
    isset($data->privacy_read_receipts) || 
    isset($data->privacy_profile_visibility) ||
    isset($data->show_in_world) ||
    isset($data->neon_color) ||
    isset($data->border_color) ||
    isset($data->button_color)
)) {
    try {
        $pdo->beginTransaction();

        // 1. Update User's Preference
        $fieldsToUpdate = [];
        $params = [':uid' => $data->user_id];

        if (isset($data->auto_delete_minutes)) {
            $fieldsToUpdate[] = "global_auto_delete_minutes = :minutes";
            $params[':minutes'] = $data->auto_delete_minutes;
        }

        if (isset($data->scramble_name)) {
            $enabled = $data->scramble_name ? 1 : 0;
            $fieldsToUpdate[] = "scramble_enabled = :sc_enabled";
            $params[':sc_enabled'] = $enabled;
            
            // If toggling ON, generate a new scramble_value by shuffling username
            if ($enabled) {
                $uStmt = $pdo->prepare("SELECT username FROM users WHERE id = :uid");
                $uStmt->execute([':uid' => $data->user_id]);
                $username = $uStmt->fetchColumn();
                
                if ($username) {
                    // Character shuffle logic
                    $newScramble = str_shuffle($username);
                    // Ensure it's different if possible (rare cases where shuffle returns same string)
                    if ($newScramble === $username && strlen($username) > 1) {
                        $newScramble = str_shuffle($username);
                    }
                    
                    $fieldsToUpdate[] = "scramble_value = :sc_value";
                    $params[':sc_value'] = $newScramble;
                }
            }
        }

        if (isset($data->privacy_last_seen)) {
            $fieldsToUpdate[] = "privacy_last_seen = :pls";
            $params[':pls'] = $data->privacy_last_seen ? 1 : 0;
        }

        if (isset($data->privacy_read_receipts)) {
            $fieldsToUpdate[] = "privacy_read_receipts = :prr";
            $params[':prr'] = $data->privacy_read_receipts ? 1 : 0;
        }

        if (isset($data->privacy_profile_visibility)) {
            $fieldsToUpdate[] = "privacy_profile_visibility = :ppv";
            $params[':ppv'] = $data->privacy_profile_visibility;
        }

        if (isset($data->show_in_world)) {
            $fieldsToUpdate[] = "show_in_world = :siw";
            $params[':siw'] = $data->show_in_world ? 1 : 0;
        }

        if (isset($data->auto_delete_otv)) {
            $fieldsToUpdate[] = "auto_delete_otv = :ado";
            $params[':ado'] = $data->auto_delete_otv ? 1 : 0;
        }

        if (isset($data->neon_color)) {
            $fieldsToUpdate[] = "neon_color = :nc";
            $params[':nc'] = $data->neon_color;
        }

        if (isset($data->border_color)) {
            $fieldsToUpdate[] = "border_color = :boc";
            $params[':boc'] = $data->border_color;
        }

        if (isset($data->button_color)) {
            $fieldsToUpdate[] = "button_color = :buc";
            $params[':buc'] = $data->button_color;
        }

        if (count($fieldsToUpdate) > 0) {
            $userQuery = "UPDATE users SET " . implode(", ", $fieldsToUpdate) . " WHERE id = :uid";
            $userStmt = $pdo->prepare($userQuery);
            $userStmt->execute($params);
        }

        // 2. Update ALL conversations where the user is either user1_id or user2_id
        $count = 0;
        if (isset($data->auto_delete_minutes)) {
            $query = "UPDATE conversations 
                      SET auto_delete_minutes = :minutes 
                      WHERE user1_id = :uid OR user2_id = :uid";
            
            $stmt = $pdo->prepare($query);
            $stmt->execute([
                ':minutes' => $data->auto_delete_minutes, 
                ':uid' => $data->user_id
            ]);
            $count = $stmt->rowCount();
        }
        $pdo->commit();

        http_response_code(200);
        $response = array(
            "message" => "Global settings updated.",
            "updated_conversations" => $count
        );
        if (isset($newScramble)) {
            $response["scramble_value"] = $newScramble;
        }
        echo json_encode($response);
    } catch (PDOException $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data. received: " . json_encode($data)));
}
?>
