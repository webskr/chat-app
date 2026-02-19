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

$group_id = isset($_POST['group_id']) ? $_POST['group_id'] : null;
$user_id = isset($_POST['user_id']) ? $_POST['user_id'] : null;

if (!$group_id || !$user_id) {
    http_response_code(400);
    echo json_encode(["message" => "Group ID and User ID are required."]);
    exit();
}

try {
    // 1. Verify User Role (Owner/Admin)
    $stmt = $pdo->prepare("SELECT role FROM group_members WHERE group_id = :gid AND user_id = :uid AND status = 'active'");
    $stmt->execute([':gid' => $group_id, ':uid' => $user_id]);
    $role = $stmt->fetchColumn();

    // Check standard roles
    if ($role === 'owner' || $role === 'admin') {
        // Allowed
    } else {
        // Check permission flag for members
        $permStmt = $pdo->prepare("SELECT allow_member_edit_info FROM groups WHERE id = :gid");
        $permStmt->execute([':gid' => $group_id]);
        $allowed = $permStmt->fetchColumn();

        if (!$allowed) {
            http_response_code(403);
            echo json_encode(["message" => "Only admins can edit group info."]);
            exit();
        }
    }

    $updates = [];
    $params = [':gid' => $group_id];

    // 2. Handle Name/Description
    if (isset($_POST['name'])) {
        $updates[] = "name = :name";
        $params[':name'] = trim($_POST['name']);
    }
    if (isset($_POST['description'])) {
        $updates[] = "description = :desc";
        $params[':desc'] = trim($_POST['description']);
    }

    // 3. Handle Icon Removal
    if (isset($_POST['remove_icon']) && $_POST['remove_icon'] == 'true') {
        $updates[] = "icon_path = NULL";
        // Ideally delete old file from server too, but skipping for simplicity
    }

    // 4. Handle Icon Upload (Overrides removal if both present, or checks logic)
    if (isset($_FILES['icon']) && $_FILES['icon']['error'] == 0) {
        $allowed = ['jpg', 'jpeg', 'png', 'gif'];
        $filename = $_FILES['icon']['name'];
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        if (in_array($ext, $allowed)) {
             $upload_dir = '../uploads/groups/';
             if (!is_dir($upload_dir)) mkdir($upload_dir, 0777, true);
             
             $new_filename = uniqid('group_', true) . '.' . $ext;
             if (move_uploaded_file($_FILES['icon']['tmp_name'], $upload_dir . $new_filename)) {
                 $updates[] = "icon_path = :icon";
                 $params[':icon'] = 'uploads/groups/' . $new_filename;
             }
        }
    }

    if (empty($updates)) {
        echo json_encode(["message" => "No changes made."]);
        exit();
    }

    $sql = "UPDATE groups SET " . implode(", ", $updates) . " WHERE id = :gid";
    $updateStmt = $pdo->prepare($sql);
    $updateStmt->execute($params);

    echo json_encode(["message" => "Group updated successfully."]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["message" => "Database error: " . $e->getMessage()]);
}
?>
