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

if (!empty($data->reporter_id) && !empty($data->reported_id) && !empty($data->reason)) {
    try {
        $query = "INSERT INTO reports (reporter_id, reported_id, reason) VALUES (:rid, :rtd, :reason)";
        $stmt = $pdo->prepare($query);
        $stmt->bindParam(':rid', $data->reporter_id);
        $stmt->bindParam(':rtd', $data->reported_id);
        $stmt->bindParam(':reason', $data->reason);

        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(array("message" => "Report submitted successfully."));
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
