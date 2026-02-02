<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once 'db_connection.php';

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->user_id) && !empty($data->target_id) && !empty($data->action)) {
    try {
        $user_id = $data->user_id;
        $target_id = $data->target_id;
        $action = $data->action; // 'friend', 'unfriend', 'block', 'unblock'

        if ($action == 'friend') {
            $query = "INSERT INTO relationships (user_id, target_id, status) VALUES (:uid, :tid, 'accepted') 
                      ON DUPLICATE KEY UPDATE status = 'accepted'";
        } elseif ($action == 'block') {
            $query = "INSERT INTO relationships (user_id, target_id, status) VALUES (:uid, :tid, 'blocked') 
                      ON DUPLICATE KEY UPDATE status = 'blocked'";
        } elseif ($action == 'unfriend' || $action == 'unblock') {
            $query = "DELETE FROM relationships WHERE user_id = :uid AND target_id = :tid";
        } else {
            http_response_code(400);
            echo json_encode(array("message" => "Invalid action."));
            exit();
        }

        $stmt = $pdo->prepare($query);
        $stmt->bindParam(':uid', $user_id);
        $stmt->bindParam(':tid', $target_id);

        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(array("message" => "Relationship updated successfully."));
        } else {
            http_response_code(500);
            echo json_encode(array("message" => "Unable to update relationship."));
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data."));
}
?>
