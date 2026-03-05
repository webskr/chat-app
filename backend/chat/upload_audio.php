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

include_once '../includes/db_connection.php';

// Validate upload
if (!isset($_FILES['audio']) || $_FILES['audio']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "No audio file uploaded or upload error."));
    exit();
}

$file = $_FILES['audio'];
$sender_id = isset($_POST['sender_id']) ? $_POST['sender_id'] : '0';
$receiver_id = isset($_POST['receiver_id']) ? $_POST['receiver_id'] : '0';

require_once __DIR__ . '/../api/utils/rateLimiter.php';
checkRateLimit($pdo, $sender_id, "upload_media", 5, 60);

// Validate file type (m4a, mp4, aac, etc.) - simplified for demo
$allowed_extensions = ['m4a', 'mp4', 'aac', 'wav', 'mp3'];
$file_ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

if (!in_array($file_ext, $allowed_extensions)) {
    // Try to guess from mime type if extension is missing/weird
    // For now, let's just allow it if it looks like audio
    if (strpos($file['type'], 'audio/') === false && strpos($file['type'], 'video/mp4') === false) { 
         http_response_code(400);
         echo json_encode(array("success" => false, "message" => "Invalid file type: " . $file['type']));
         exit();
    }
}

// Generate unique filename
$upload_dir = '../uploads/voice/';
if (!is_dir($upload_dir)) {
    mkdir($upload_dir, 0777, true);
}

$filename = uniqid('voice_') . '_' . time() . '.' . ($file_ext ?: 'm4a');
$target_path = $upload_dir . $filename;

if (move_uploaded_file($file['tmp_name'], $target_path)) {
    // Return the relative path for storage
    // Assuming backend is at root/backend, and we want to access via http://.../backend/uploads/voice/...
    // But our structure is backend/uploads/voice.
    // The previous image upload returned 'backend/uploads/...' so let's follow that pattern if needed.
    // Actually, check image upload. It returns 'backend/uploads/...' ?
    // Let's check `upload_image.php` to match the path convention.
    
    $public_url = 'uploads/voice/' . $filename;
    
    echo json_encode(array(
        "success"    => true, 
        "message"    => "Audio uploaded successfully.",
        "audio_url"  => $public_url,
        "created_at" => date('Y-m-d H:i:s')
    ));
} else {
    http_response_code(500);
    echo json_encode(array("success" => false, "message" => "Failed to move uploaded file."));
}
?>
