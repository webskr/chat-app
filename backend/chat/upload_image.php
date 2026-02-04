<?php
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
    debug_log("REQUEST RECEIVED");
    debug_log($_SERVER);

    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        http_response_code(200);
        exit();
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception("Invalid request method: " . $_SERVER['REQUEST_METHOD']);
    }

    debug_log("FILES received:");
    debug_log($_FILES);

    if (!isset($_FILES['image'])) {
        throw new Exception("No 'image' file in request");
    }

    if ($_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception("File upload error code: " . $_FILES['image']['error']);
    }

    // Determine upload directory: backend/uploads
    $target_dir = __DIR__ . "/../uploads/";
    
    if (!file_exists($target_dir)) {
        if (!mkdir($target_dir, 0777, true)) {
            throw new Exception("Failed to create upload directory: " . $target_dir);
        }
    }
    
    $file_extension = pathinfo($_FILES["image"]["name"], PATHINFO_EXTENSION);
    debug_log("Extension: " . $file_extension);

    // basic validation
    $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!in_array(strtolower($file_extension), $allowed)) {
         throw new Exception("Invalid file format: " . $file_extension);
    }

    // Custom Filename Logic
    // Default fallback if IDs missing
    $sender_id = isset($_POST['sender_id']) ? $_POST['sender_id'] : '0';
    $receiver_id = isset($_POST['receiver_id']) ? $_POST['receiver_id'] : '0';
    $date_str = date('dmY');
    
    // Sanitize original filename (remove special chars, only keep A-Z, 0-9, -, _)
    // We want to keep the name readable but safe.
    $original_name = pathinfo($_FILES["image"]["name"], PATHINFO_FILENAME);
    $safe_name = preg_replace("/[^a-zA-Z0-9\-_]/", "", $original_name);
    
    // Format: SenderID + Date + ReceiverID + OriginalName
    // Example: 1(sender) 16052026(date) 16(receiver) myphoto.jpg
    $new_filename = $sender_id . $date_str . $receiver_id . $safe_name . '.' . $file_extension;
    
    debug_log("Generated Filename: " . $new_filename);

    $target_file = $target_dir . $new_filename;
    
    // Check if image file is a actual image or fake image
    $check = getimagesize($_FILES["image"]["tmp_name"]);
    if($check === false) {
        throw new Exception("File is not a valid image");
    }

    if (move_uploaded_file($_FILES["image"]["tmp_name"], $target_file)) {
        debug_log("Upload Success: " . $target_file);
        
        // Return path relative to API_URL
        echo json_encode([
            "success" => true, // Explicit success flag
            "message" => "Image uploaded successfully", 
            "image_path" => "uploads/" . $new_filename,
            "media_url" => "uploads/" . $new_filename // Redundant but helpful
        ]);
    } else {
        throw new Exception("Failed to move uploaded file");
    }

} catch (Exception $e) {
    debug_log("ERROR: " . $e->getMessage());
    http_response_code(500); // Or 400 depending on error
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
        "error" => $e->getMessage()
    ]);
}
?>
