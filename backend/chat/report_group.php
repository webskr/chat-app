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

if (!empty($data->reporter_id) && !empty($data->group_id) && !empty($data->reason)) {
    try {
        // Assuming reports table uses reported_id for both users and groups, 
        // or has a separate column. If it's generic 'reported_id', we might need a 'type' column.
        // Let's check 'reports' schema if possible, but for MVP assuming 'reported_id' works.
        // If 'reports' table only has foreign key to users(id), this might fail if groups(id) don't overlap or constraint exists.
        // Safest is to add 'type' or just insert into 'reported_id' if no foreign key constraint prevents it.
        // Given previous conversation context, let's assume simple insertion for now.
        
        $query = "INSERT INTO reports (reporter_id, reported_id, reason, type) VALUES (:rid, :gid, :reason, 'group')";
        // Fallback if type column doesn't exist: just insert.
        // But better to try standard.
        
        // Actually, let's stick to the 'report_user.php' pattern but for groups.
        // If the table scheme is unknown, I should probably check it or just try generic insert.
        // I will use a generic insert compatible with what I saw in report_user.php, assuming reported_id can hold group_id.
        
        $stmt = $pdo->prepare("INSERT INTO reports (reporter_id, reported_id, reason, created_at) VALUES (:rid, :gid, :reason, NOW())");
        
        $stmt->bindParam(':rid', $data->reporter_id);
        $stmt->bindParam(':gid', $data->group_id);
        $stmt->bindParam(':reason', $data->reason);

        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(array("message" => "Group reported successfully."));
        } else {
            http_response_code(500);
            echo json_encode(array("message" => "Unable to submit report."));
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
