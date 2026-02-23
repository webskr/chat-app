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

// Required: user_id (me, the receiver), sender_id (the other person), status
if (!empty($data->user_id) && !empty($data->sender_id) && !empty($data->status)) {
    
    $user_id = (int)$data->user_id;     // Receiver (Me)
    $sender_id = (int)$data->sender_id; // Sender (Them)
    $status = $data->status;

    if (!in_array($status, ['delivered', 'seen'])) {
        http_response_code(400);
        echo json_encode(["message" => "Invalid status"]);
        exit;
    }

    try {
        $pdo->beginTransaction();

        $updatedCount = 0;

        if ($status === 'delivered' || $status === 'seen') {
            // Ephemeral Storage Policy: "delivered -> delete immediately"
            // Both 'delivered' and 'seen' indicate the message successfully reached the recipient.
            // Therefore, we securely purge it from the server queue.
            
            $query = "DELETE FROM messages 
                      WHERE receiver_id = :me 
                      AND sender_id = :them";
            
            $stmt = $pdo->prepare($query);
            $stmt->execute([':me' => $user_id, ':them' => $sender_id]);
            $updatedCount = $stmt->rowCount();
        }

        $pdo->commit();

        echo json_encode([
            "message" => "Status updated",
            "updated_count" => $updatedCount
        ]);

    } catch (PDOException $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }

} else {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data"]);
}
?>
