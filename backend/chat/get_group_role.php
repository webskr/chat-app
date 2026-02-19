<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
include_once '../includes/db_connection.php';

$group_id = isset($_GET['group_id']) ? (int)$_GET['group_id'] : 0;
$user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;

if (!$group_id || !$user_id) {
    echo json_encode(["role" => null]);
    exit;
}

$stmt = $pdo->prepare("
    SELECT gm.role, 
           g.allow_member_edit_info, 
           g.allow_member_send_messages, 
           g.allow_member_add_members
    FROM group_members gm
    JOIN groups g ON gm.group_id = g.id
    WHERE gm.group_id = :gid AND gm.user_id = :uid
");
$stmt->execute([':gid' => $group_id, ':uid' => $user_id]);
$result = $stmt->fetch(PDO::FETCH_ASSOC);

if ($result) {
    echo json_encode([
        "role" => $result['role'],
        "permissions" => [
            "edit_info" => (bool)$result['allow_member_edit_info'],
            "send_messages" => (bool)$result['allow_member_send_messages'],
            "add_members" => (bool)$result['allow_member_add_members']
        ]
    ]);
} else {
    echo json_encode(["role" => null, "permissions" => null]);
}
?>
