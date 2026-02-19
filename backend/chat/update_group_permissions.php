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

if (empty($data->group_id) || empty($data->user_id)) {
    http_response_code(400);
    echo json_encode(["message" => "Group ID and User ID are required."]);
    exit();
}

try {
    // 1. Verify User Role (Owner/Admin)
    $stmt = $pdo->prepare("SELECT role, status FROM group_members WHERE group_id = :gid AND user_id = :uid");
    $stmt->execute([':gid' => $data->group_id, ':uid' => $data->user_id]);
    $member = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$member || $member['status'] !== 'active' || ($member['role'] !== 'owner' && $member['role'] !== 'admin')) {
        http_response_code(403);
        echo json_encode(["message" => "Only admins can change group settings."]);
        exit();
    }

    $updates = [];
    $params = [':gid' => $data->group_id];

    // Handle boolean flags
    $settings = [
        'allow_member_edit_info', 
        'allow_member_send_messages', 
        'allow_member_add_members', 
        'admin_approve_new_members'
    ];

    foreach ($settings as $setting) {
        if (isset($data->$setting)) {
            $updates[] = "$setting = :$setting";
            $params[":$setting"] = $data->$setting ? 1 : 0;
        }
    }

    if (empty($updates)) {
        echo json_encode(["message" => "No changes provided."]);
        exit();
    }

    $sql = "UPDATE groups SET " . implode(", ", $updates) . " WHERE id = :gid";
    $updateStmt = $pdo->prepare($sql);
    $updateStmt->execute($params);

    echo json_encode(["message" => "Group settings updated."]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["message" => "Database error: " . $e->getMessage()]);
}
?>
