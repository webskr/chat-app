<?php
date_default_timezone_set('Asia/Kolkata');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

function debug_log($message) {
    $log_file = __DIR__ . "/backend_debug.log";
    $entry = date('Y-m-d H:i:s') . " - " . print_r($message, true) . "\n";
    file_put_contents($log_file, $entry, FILE_APPEND);
}

try {
    debug_log("AUDIO UPLOAD REQUEST RECEIVED");

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception("Invalid request method");
    if (!isset($_FILES['audio'])) throw new Exception("No 'audio' file in request");
    if ($_FILES['audio']['error'] !== UPLOAD_ERR_OK) throw new Exception("File upload error: " . $_FILES['audio']['error']);

    require_once __DIR__ . '/../includes/db_connection.php';
    require_once __DIR__ . '/../api/utils/rateLimiter.php';
    require_once __DIR__ . '/../includes/auth_middleware.php';

    $authenticated_user_id = authenticate($pdo);
    checkRateLimit($pdo, $authenticated_user_id, "upload_media", 10, 60);

    $sender_id = $authenticated_user_id;
    $receiver_id = isset($_POST['receiver_id']) ? $_POST['receiver_id'] : '0';
    $duration = isset($_POST['duration']) ? (int)$_POST['duration'] : 0;

    $target_dir = __DIR__ . "/../uploads/voice/";
    if (!file_exists($target_dir)) mkdir($target_dir, 0777, true);

    $file_extension = strtolower(pathinfo($_FILES["audio"]["name"], PATHINFO_EXTENSION));
    $allowed = ['m4a', 'mp4', 'aac', 'wav', 'mp3', 'ogg'];
    // If no extension, try to map from type
    if (!$file_extension) {
        if (strpos($_FILES['audio']['type'], 'audio/m4a') !== false) $file_extension = 'm4a';
        else if (strpos($_FILES['audio']['type'], 'audio/') !== false) $file_extension = 'wav';
    }

    $filename = 'voice_' . uniqid() . '_' . time() . '.' . ($file_extension ?: 'm4a');
    $target_file = $target_dir . $filename;

    if (move_uploaded_file($_FILES["audio"]["tmp_name"], $target_file)) {
        debug_log("Upload Success: " . $target_file);
        echo json_encode([
            "success"    => true,
            "message"    => "Audio uploaded successfully",
            "audio_url"  => "uploads/voice/" . $filename,
            "media_url"  => "uploads/voice/" . $filename,
            "duration"   => $duration,
            "created_at" => date('Y-m-d H:i:s')
        ]);
    } else {
        throw new Exception("Failed to move uploaded file");
    }

} catch (Throwable $e) {
    debug_log("AUDIO UPLOAD ERROR: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => $e->getMessage(), "error" => $e->getMessage()]);
}
?>
