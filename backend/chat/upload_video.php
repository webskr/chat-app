<?php
date_default_timezone_set('Asia/Kolkata');
// Ensure JSON response
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// Debug logging function
function debug_log($message) {
    $log_file = __DIR__ . "/backend_debug.log";
    $entry = date('Y-m-d H:i:s') . " - " . print_r($message, true) . "\n";
    file_put_contents($log_file, $entry, FILE_APPEND);
}

try {
    debug_log("VIDEO UPLOAD REQUEST RECEIVED");
    
    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        http_response_code(200);
        exit();
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception("Invalid request method: " . $_SERVER['REQUEST_METHOD']);
    }

    if (!isset($_FILES['video'])) {
        throw new Exception("No 'video' file in request");
    }

    if ($_FILES['video']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception("File upload error code: " . $_FILES['video']['error']);
    }

    // Determine upload directory: backend/uploads/videos
    $target_dir = __DIR__ . "/../uploads/videos/";
    
    if (!file_exists($target_dir)) {
        if (!mkdir($target_dir, 0777, true)) {
            throw new Exception("Failed to create upload directory: " . $target_dir);
        }
    }
    
    $file_extension = pathinfo($_FILES["video"]["name"], PATHINFO_EXTENSION);
    $file_size = $_FILES["video"]["size"];
    
    debug_log("Extension: " . $file_extension . ", Size: " . $file_size);

    // Validation
    $allowed = ['mp4', 'mov', 'mkv', 'webm'];
    if (!in_array(strtolower($file_extension), $allowed)) {
         throw new Exception("Invalid file format: " . $file_extension);
    }
    
    // Max size: 20MB
    if ($file_size > 20 * 1024 * 1024) {
        throw new Exception("File too large. Max 20MB.");
    }

    // Custom Filename Logic
    $sender_id = isset($_POST['sender_id']) ? $_POST['sender_id'] : '0';
    $receiver_id = isset($_POST['receiver_id']) ? $_POST['receiver_id'] : '0';

    require_once __DIR__ . '/../api/utils/rateLimiter.php';
    require_once __DIR__ . '/../includes/db_connection.php';
    checkRateLimit($pdo, $sender_id, "upload_media", 5, 60);

    $date_str = date('dmYHis');
    
    $original_name = pathinfo($_FILES["video"]["name"], PATHINFO_FILENAME);
    $safe_name = preg_replace("/[^a-zA-Z0-9\-_]/", "", $original_name);
    
    $new_filename = "vid_" . $sender_id . "_" . $date_str . "_" . $safe_name . '.' . $file_extension;
    
    $target_file = $target_dir . $new_filename;
    
    if (move_uploaded_file($_FILES["video"]["tmp_name"], $target_file)) {
        debug_log("Upload Success: " . $target_file);
        
        // Handle thumbnail upload if present
        $thumbnail_path = null;
        if (isset($_FILES['thumbnail']) && $_FILES['thumbnail']['error'] === UPLOAD_ERR_OK) {
             $thumb_dir = __DIR__ . "/../uploads/thumbnails/";
             if (!file_exists($thumb_dir)) mkdir($thumb_dir, 0777, true);
             
             $thumb_ext = pathinfo($_FILES['thumbnail']['name'], PATHINFO_EXTENSION);
             $thumb_name = "thumb_" . $sender_id . "_" . $date_str . "_" . $safe_name . "." . $thumb_ext;
             $thumb_target = $thumb_dir . $thumb_name;
             
             if (move_uploaded_file($_FILES['thumbnail']['tmp_name'], $thumb_target)) {
                 $thumbnail_path = "uploads/thumbnails/" . $thumb_name;
             }
        }
        
        echo json_encode([
            "success"        => true,
            "message"        => "Video uploaded successfully", 
            "video_path"     => "uploads/videos/" . $new_filename,
            "media_url"      => "uploads/videos/" . $new_filename,
            "thumbnail_path" => $thumbnail_path,
            "file_size"      => $file_size,
            "created_at"     => date('Y-m-d H:i:s')
        ]);
    } else {
        throw new Exception("Failed to move uploaded file");
    }

} catch (Throwable $e) {
    debug_log("ERROR: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
        "error" => $e->getMessage()
    ]);
}
?>
