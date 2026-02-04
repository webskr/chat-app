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

if (!empty($data->user_id) && (isset($data->auto_delete_minutes) || isset($data->scramble_name))) {
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
            $fieldsToUpdate[] = "scramble_name = :scramble";
            $params[':scramble'] = $data->scramble_name ? 1 : 0;
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
        echo json_encode(array(
            "message" => "Global settings updated.",
            "updated_conversations" => $count
        ));
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
