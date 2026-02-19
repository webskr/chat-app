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

// Required: user_id (me), target_id (sender or group_id), is_group (boolean)
if (!empty($data->user_id) && !empty($data->target_id)) {
    
    $user_id = (int)$data->user_id;
    $target_id = (int)$data->target_id;
    $is_group = isset($data->is_group) ? filter_var($data->is_group, FILTER_VALIDATE_BOOLEAN) : false;

    try {
        $pdo->beginTransaction();

        if ($is_group) {
            // Group Chat: Update my last_read_at in group_members
            $query = "UPDATE group_members 
                      SET last_read_at = NOW() 
                      WHERE group_id = :gid 
                      AND user_id = :uid";
            $stmt = $pdo->prepare($query);
            $stmt->execute([':gid' => $target_id, ':uid' => $user_id]);

        } else {
            // 1-on-1 Chat: Update status of messages sent BY target TO me
            // Only update messages that are not yet 'seen'
            $query = "UPDATE messages 
                      SET status = 'seen', 
                          read_at = NOW(),
                          delivered_at = COALESCE(delivered_at, NOW())
                      WHERE receiver_id = :me 
                      AND sender_id = :them 
                      AND status != 'seen'
                      AND is_one_time = 0"; // Do not mark one-time messages as seen via this bulk action if deemed necessary, but usually opening chat marks them seen. Actually, standard messages become seen. One-time might be handled differently, but let's assume opening chat marks them seen too for now (or at least status=seen).
            
            $stmt = $pdo->prepare($query);
            $stmt->execute([':me' => $user_id, ':them' => $target_id]);
        }

        $pdo->commit();

        echo json_encode(["status" => "success", "message" => "Marked as read"]);

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
