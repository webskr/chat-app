<?php
date_default_timezone_set('Asia/Kolkata');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

function debug_log($message) {
    $log_file = __DIR__ . "/backend_debug.log";
    $entry = date('Y-m-d H:i:s') . " - " . print_r($message, true) . "\n";
    file_put_contents($log_file, $entry, FILE_APPEND);
}

try {
    debug_log("REQUEST RECEIVED");

    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') { http_response_code(200); exit(); }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception("Invalid request method");
    if (!isset($_FILES['image'])) throw new Exception("No 'image' file in request");
    if ($_FILES['image']['error'] !== UPLOAD_ERR_OK) throw new Exception("File upload error: " . $_FILES['image']['error']);

    // ── Full Image ───────────────────────────────────────────────────────────
    $target_dir = __DIR__ . "/../uploads/";
    if (!file_exists($target_dir)) mkdir($target_dir, 0777, true);

    $file_extension = strtolower(pathinfo($_FILES["image"]["name"], PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!in_array($file_extension, $allowed)) throw new Exception("Invalid file format: " . $file_extension);

    $check = getimagesize($_FILES["image"]["tmp_name"]);
    if ($check === false) throw new Exception("File is not a valid image");

    $sender_id   = isset($_POST['sender_id'])   ? $_POST['sender_id']   : '0';
    $receiver_id = isset($_POST['receiver_id']) ? $_POST['receiver_id'] : '0';
    $date_str    = date('dmY');
    $original_name = pathinfo($_FILES["image"]["name"], PATHINFO_FILENAME);
    $safe_name     = preg_replace("/[^a-zA-Z0-9\-_]/", "", $original_name);
    $new_filename  = $sender_id . $date_str . $receiver_id . $safe_name . '.' . $file_extension;
    $target_file   = $target_dir . $new_filename;

    if (!move_uploaded_file($_FILES["image"]["tmp_name"], $target_file)) {
        throw new Exception("Failed to move uploaded file");
    }

    // ── Thumbnail Generation (PHP GD) ────────────────────────────────────────
    $thumbnail_path = null;
    try {
        $thumb_dir = __DIR__ . "/../uploads/thumbnails/";
        if (!file_exists($thumb_dir)) mkdir($thumb_dir, 0777, true);

        $thumb_w = 300;
        $thumb_h = 300;

        // Load source image based on extension
        switch ($file_extension) {
            case 'jpg': case 'jpeg': $src = imagecreatefromjpeg($target_file); break;
            case 'png':              $src = imagecreatefrompng($target_file);  break;
            case 'webp':             $src = imagecreatefromwebp($target_file); break;
            case 'gif':              $src = imagecreatefromgif($target_file);  break;
            default:                 $src = null;
        }

        if ($src) {
            $srcW   = imagesx($src);
            $srcH   = imagesy($src);
            $ratio  = min($thumb_w / $srcW, $thumb_h / $srcH);
            $destW  = (int)($srcW * $ratio);
            $destH  = (int)($srcH * $ratio);

            $thumb = imagecreatetruecolor($destW, $destH);

            // Preserve transparency for PNG
            if (in_array($file_extension, ['png', 'gif'])) {
                imagealphablending($thumb, false);
                imagesavealpha($thumb, true);
                $transparent = imagecolorallocatealpha($thumb, 0, 0, 0, 127);
                imagefilledrectangle($thumb, 0, 0, $destW, $destH, $transparent);
            }

            imagecopyresampled($thumb, $src, 0, 0, 0, 0, $destW, $destH, $srcW, $srcH);

            $thumb_name   = "thumb_" . $sender_id . $date_str . $receiver_id . $safe_name . ".jpg";
            $thumb_target = $thumb_dir . $thumb_name;

            imagejpeg($thumb, $thumb_target, 75); // 75% quality
            imagedestroy($src);
            imagedestroy($thumb);

            $thumbnail_path = "uploads/thumbnails/" . $thumb_name;
            debug_log("Thumbnail generated: " . $thumb_target);
        }
    } catch (Throwable $thumbErr) {
        debug_log("Thumbnail generation failed (non-fatal): " . $thumbErr->getMessage());
        // Thumbnail failure is non-fatal — full image is still uploaded
    }

    debug_log("Upload Success: " . $target_file);

    echo json_encode([
        "success"        => true,
        "message"        => "Image uploaded successfully",
        "image_path"     => "uploads/" . $new_filename,
        "media_url"      => "uploads/" . $new_filename,
        "thumbnail_path" => $thumbnail_path ?? ("uploads/" . $new_filename),
        "created_at"     => date('Y-m-d H:i:s')
    ]);

} catch (Throwable $e) {
    debug_log("ERROR: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => $e->getMessage(), "error" => $e->getMessage()]);
}
?>
