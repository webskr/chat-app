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

if (empty($data->action) || empty($data->group_id) || empty($data->user_id)) {
    http_response_code(400);
    echo json_encode(["message" => "Action, Group ID, and User ID are required."]);
    exit();
}

$action = $data->action;
$group_id = $data->group_id;
$user_id = $data->user_id; // The user performing the action

try {
    // Check if user is member/admin/owner
    $check_stmt = $pdo->prepare("SELECT role, status FROM group_members WHERE group_id = :gid AND user_id = :uid");
    $check_stmt->execute([':gid' => $group_id, ':uid' => $user_id]);
    $requester = $check_stmt->fetch(PDO::FETCH_ASSOC);

    if (!$requester || $requester['status'] !== 'active') {
        http_response_code(403);
        echo json_encode(["message" => "You are not a member of this group."]);
        exit();
    }

    $requester_role = $requester['role'];

    switch ($action) {
        case 'add_member':
            $target_id = $data->target_id ?? null;
            if (!$target_id) {
                http_response_code(400); echo json_encode(["message" => "Target user ID required."]); exit();
            }
            if ($requester_role !== 'owner') {
                // Check permission for Admins and Members
                $permStmt = $pdo->prepare("SELECT allow_member_add_members FROM groups WHERE id = :gid");
                $permStmt->execute([':gid' => $group_id]);
                if (!$permStmt->fetchColumn()) {
                     http_response_code(403); echo json_encode(["message" => "Only the owner can add members."]); exit();
                }
            }

            // Check if target is already member
            $target_check = $pdo->prepare("SELECT status FROM group_members WHERE group_id = :gid AND user_id = :uid");
            $target_check->execute([':gid' => $group_id, ':uid' => $target_id]);
            $target_status = $target_check->fetchColumn();

            if ($target_status === 'active') {
                http_response_code(400); echo json_encode(["message" => "User is already a member."]); exit();
            } elseif ($target_status) {
                // Re-add (active)
                $upd = $pdo->prepare("UPDATE group_members SET status = 'active', joined_at = NOW() WHERE group_id = :gid AND user_id = :uid");
                $upd->execute([':gid' => $group_id, ':uid' => $target_id]);
            } else {
                // Insert new
                $ins = $pdo->prepare("INSERT INTO group_members (group_id, user_id, role, status) VALUES (:gid, :uid, 'member', 'active')");
                $ins->execute([':gid' => $group_id, ':uid' => $target_id]);
            }
            
            // System message
            $sys_msg = $pdo->prepare("INSERT INTO messages (conversation_id, sender_id, message_text, created_at) SELECT id, :sid, 'Added a member', NOW() FROM conversations WHERE group_id = :gid");
            // Better to use a specific system user or the adder. 
            // "Added a member" from the adder.
            $sys_msg->execute([':sid' => $user_id, ':gid' => $group_id]);

            echo json_encode(["message" => "Member added successfully."]);
            break;

        case 'remove_member':
            $target_id = $data->target_id ?? null;
            if (!$target_id) {
                http_response_code(400); echo json_encode(["message" => "Target user ID required."]); exit();
            }
            if ($requester_role !== 'owner' && $requester_role !== 'admin') {
                http_response_code(403); echo json_encode(["message" => "Only admins can remove members."]); exit();
            }
            if ($user_id == $target_id) {
                 http_response_code(400); echo json_encode(["message" => "Use 'leave_group' to remove yourself."]); exit();
            }
            // Cannot remove owner
            $target_role_stmt = $pdo->prepare("SELECT role FROM group_members WHERE group_id = :gid AND user_id = :uid");
            $target_role_stmt->execute([':gid' => $group_id, ':uid' => $target_id]);
            $target_role = $target_role_stmt->fetchColumn();
            
            if ($target_role === 'owner') {
                http_response_code(403); echo json_encode(["message" => "Cannot remove the owner."]); exit();
            }

            $rm = $pdo->prepare("UPDATE group_members SET status = 'removed' WHERE group_id = :gid AND user_id = :uid");
            $rm->execute([':gid' => $group_id, ':uid' => $target_id]);
            
            // System message
            $sys_msg = $pdo->prepare("INSERT INTO conversations (id, last_message, last_message_time) SELECT id, 'Removed a member', NOW() FROM conversations WHERE group_id = :gid ON DUPLICATE KEY UPDATE last_message = 'Removed a member', last_message_time = NOW()");
             // Actually insert into messages table
            $conv_id_stmt = $pdo->prepare("SELECT id FROM conversations WHERE group_id = :gid");
            $conv_id_stmt->execute([':gid' => $group_id]);
            $conv_id = $conv_stmt->fetchColumn();
            // TODO: Extract system message logic to function or just insert message
            
            echo json_encode(["message" => "Member removed."]);
            break;

        case 'leave_group':
            if ($requester_role === 'owner') {
                 // Owner cannot leave without transferring ownership? Or deletes group? 
                 // Prompt says "Can Delete the group". 
                 // If owner leaves, maybe just mark as left.
                 // Let's allow leaving for now.
            }
            $leave = $pdo->prepare("UPDATE group_members SET status = 'left' WHERE group_id = :gid AND user_id = :uid");
            $leave->execute([':gid' => $group_id, ':uid' => $user_id]);
            echo json_encode(["message" => "You left the group."]);
            break;

        case 'delete_group':
            if ($requester_role !== 'owner') {
                http_response_code(403); echo json_encode(["message" => "Only owner can delete group."]); exit();
            }
            $del = $pdo->prepare("DELETE FROM groups WHERE id = :gid");
            $del->execute([':gid' => $group_id]);
            echo json_encode(["message" => "Group deleted."]);
            break;

        case 'clear_chat_self':
            // Logic: Update cleared_at to NOW() for the requesting user
            $clear = $pdo->prepare("UPDATE group_members SET cleared_at = NOW() WHERE group_id = :gid AND user_id = :uid");
            $clear->execute([':gid' => $group_id, ':uid' => $user_id]);
            echo json_encode(["message" => "Chat cleared for you."]);
            break;

        case 'promote_admin':
            if ($requester_role !== 'owner') {
                http_response_code(403); echo json_encode(["message" => "Only owner can promote admins."]); exit();
            }
            $target_id = $data->target_id ?? null;
            if (!$target_id) {
                http_response_code(400); echo json_encode(["message" => "Target user ID required."]); exit();
            }

            // Check current admin count
            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM group_members WHERE group_id = :gid AND role = 'admin' AND status = 'active'");
            $countStmt->execute([':gid' => $group_id]);
            $adminCount = $countStmt->fetchColumn();

            if ($adminCount >= 3) {
                http_response_code(400); echo json_encode(["message" => "Limit of 3 admins reached."]); exit();
            }

            $update = $pdo->prepare("UPDATE group_members SET role = 'admin' WHERE group_id = :gid AND user_id = :uid");
            $update->execute([':gid' => $group_id, ':uid' => $target_id]);

            // System message? optional
            echo json_encode(["message" => "Member promoted to Admin."]);
            break;

        case 'demote_admin':
            if ($requester_role !== 'owner') {
                http_response_code(403); echo json_encode(["message" => "Only owner can demote admins."]); exit();
            }
            $target_id = $data->target_id ?? null;
            if (!$target_id) {
                http_response_code(400); echo json_encode(["message" => "Target user ID required."]); exit();
            }

            // Verify target is actually an admin?
            // Just set to member is fine.
            $update = $pdo->prepare("UPDATE group_members SET role = 'member' WHERE group_id = :gid AND user_id = :uid");
            $update->execute([':gid' => $group_id, ':uid' => $target_id]);

            echo json_encode(["message" => "Admin dismissed to Member."]);
            break;

        default:
            http_response_code(400); echo json_encode(["message" => "Invalid action."]); exit();
    }

} catch (PDOException $e) {
    http_response_code(500); echo json_encode(["message" => "Database error: " . $e->getMessage()]);
}
?>
