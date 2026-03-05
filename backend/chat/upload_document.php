<?php
date_default_timezone_set('Asia/Kolkata');
// backend/chat/upload_document.php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

function debug_log($message) {
    $log_file = __DIR__ . "/backend_debug.log";
    $entry = date('Y-m-d H:i:s') . " - " . print_r($message, true) . "\n";
    file_put_contents($log_file, $entry, FILE_APPEND);
}

try {
    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        http_response_code(200);
        exit();
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception("Invalid request method");
    }

    if (!isset($_FILES['document'])) {
        throw new Exception("No 'document' file in request");
    }

    if ($_FILES['document']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception("File upload error code: " . $_FILES['document']['error']);
    }

    $target_dir = __DIR__ . "/../uploads/documents/";
    if (!file_exists($target_dir)) {
        if (!mkdir($target_dir, 0777, true)) {
            throw new Exception("Failed to create directory: " . $target_dir);
        }
    }

    $original_name = $_FILES["document"]["name"];
    $file_extension = strtolower(pathinfo($original_name, PATHINFO_EXTENSION));
    $file_size = $_FILES["document"]["size"];
    $mime_type = $_FILES["document"]["type"]; // Trust but verify if needed

    // Validation
    $allowed_exts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'csv'];
    if (!in_array($file_extension, $allowed_exts)) {
        throw new Exception("Invalid file type: " . $file_extension);
    }

    if ($file_size > 20 * 1024 * 1024) { // 20MB
         throw new Exception("File too large. Max 20MB.");
    }

    // Generate safe filename
    $sender_id   = isset($_POST['sender_id'])   ? $_POST['sender_id']   : '0';
    $receiver_id = isset($_POST['receiver_id']) ? $_POST['receiver_id'] : '0';

    require_once __DIR__ . '/../api/utils/rateLimiter.php';
    require_once __DIR__ . '/../includes/db_connection.php';
    checkRateLimit($pdo, $sender_id, "upload_media", 5, 60);
    $date_str = date('dmYHis');
    $safe_name = preg_replace("/[^a-zA-Z0-9\-_]/", "", pathinfo($original_name, PATHINFO_FILENAME));
    $new_filename = "doc_" . $sender_id . "_" . $date_str . "_" . $safe_name . "." . $file_extension;
    
    $target_file = $target_dir . $new_filename;

    if (move_uploaded_file($_FILES["document"]["tmp_name"], $target_file)) {
        echo json_encode([
            "success"    => true,
            "message"    => "File uploaded successfully",
            "file_path"  => "uploads/documents/" . $new_filename,
            "media_url"  => "uploads/documents/" . $new_filename,
            "file_name"  => $original_name,
            "file_size"  => $file_size,
            "mime_type"  => $mime_type,
            "created_at" => date('Y-m-d H:i:s')
        ]);
    } else {
        throw new Exception("Failed to move uploaded file");
    }

} catch (Exception $e) {
    debug_log("DOC UPLOAD ERROR: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
