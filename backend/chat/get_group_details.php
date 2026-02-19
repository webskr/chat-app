<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../includes/db_connection.php';

$group_id = isset($_GET['group_id']) ? (int)$_GET['group_id'] : 0;
$user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;

if (!$group_id || !$user_id) {
    http_response_code(400);
    echo json_encode(["message" => "Group ID and User ID are required."]);
    exit();
}

try {
    // 1. Fetch Group Info
    $stmt = $pdo->prepare("SELECT id, name, description, icon_path, created_by, created_at, allow_member_edit_info, allow_member_send_messages, allow_member_add_members, admin_approve_new_members FROM groups WHERE id = :gid");
    $stmt->execute([':gid' => $group_id]);
    $group = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$group) {
        http_response_code(404);
        echo json_encode(["message" => "Group not found."]);
        exit();
    }

    // 2. Check if requester is a member (to allow viewing)
    $memberCheck = $pdo->prepare("SELECT role, status FROM group_members WHERE group_id = :gid AND user_id = :uid");
    $memberCheck->execute([':gid' => $group_id, ':uid' => $user_id]);
    $membership = $memberCheck->fetch(PDO::FETCH_ASSOC);

    if (!$membership || $membership['status'] !== 'active') {
        // Option: allow non-members to see basic info? 
        // For now, restrict to members or maybe just basic info.
        // Let's return is_member = false
        $group['is_member'] = false;
        $group['my_role'] = null;
    } else {
        $group['is_member'] = true;
        $group['my_role'] = $membership['role'];
    }

    // 3. Fetch Members
    $membersStmt = $pdo->prepare("
        SELECT u.id, u.username, u.display_name, u.avatar_id, u.avatar_url, u.is_official, u.last_seen,
               gm.role, gm.joined_at, gm.status
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = :gid AND gm.status = 'active'
        ORDER BY CASE WHEN gm.role = 'owner' THEN 1 WHEN gm.role = 'admin' THEN 2 ELSE 3 END, u.username ASC
    ");
    $membersStmt->execute([':gid' => $group_id]);
    $members = $membersStmt->fetchAll(PDO::FETCH_ASSOC);

    $group['members'] = $members;
    $group['member_count'] = count($members);

    echo json_encode($group);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["message" => "Database error: " . $e->getMessage()]);
}
?>
