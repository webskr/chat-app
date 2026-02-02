<?php
// Better CORS handling for Web
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');
}

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD']))
        header("Access-Control-Allow-Methods: GET, POST, OPTIONS");         
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']))
        header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
    exit(0);
}

header("Content-Type: application/json; charset=UTF-8");

include_once '../includes/db_connection.php';

try {
    $stmt = $pdo->query("SELECT 1");
    if ($stmt) {
        http_response_code(200);
        echo json_encode(array(
            "status" => "success",
            "message" => "Database connection successful!",
            "server_ip" => $_SERVER['SERVER_ADDR'] ?? 'unknown'
        ));
    } else {
        throw new Exception("Query failed");
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(array(
        "status" => "error",
        "message" => "Database connection failed: " . $e->getMessage()
    ));
}
