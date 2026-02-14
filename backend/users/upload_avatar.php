<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");
error_reporting(0);
ini_set('display_errors', 0);

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../includes/db_connection.php';

$user_id = isset($_POST['user_id']) ? $_POST['user_id'] : null;

if (!$user_id) {
    http_response_code(400);
    echo json_encode(array("message" => "User ID is required."));
    exit();
}

if (!isset($_FILES['avatar'])) {
    http_response_code(400);
    echo json_encode(array("message" => "No file uploaded."));
    exit();
}

$file = $_FILES['avatar'];
$fileName = $file['name'];
$fileTmpName = $file['tmp_name'];
$fileSize = $file['size'];
$fileError = $file['error'];
$fileType = $file['type'];

if ($fileError === 0) {
    $fileNameParts = explode('.', $fileName);
    $fileExt = strtolower(end($fileNameParts));
    $allowed = array('jpg', 'jpeg', 'png', 'gif', 'webp');

    if (in_array($fileExt, $allowed)) {
        if ($fileSize < 5000000) { // 5MB limit
            $newFileName = "avatar_" . $user_id . "_" . uniqid('', true) . "." . $fileExt;
            $uploadDir = '../uploads/avatars/';
            
            if (!file_exists($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }

            $fileDestination = $uploadDir . $newFileName;

            if (move_uploaded_file($fileTmpName, $fileDestination)) {
                // Update database
                try {
                    // Update user's avatar_url and set avatar_id to 'custom' (or keep existing logic)
                    // We'll treat a non-null avatar_url as the source of truth if avatar_id is 'custom' or just prioritize it
                    
                    // Let's set avatar_id to 'custom' so the frontend knows to look at avatar_url
                    $stmt = $pdo->prepare("UPDATE users SET avatar_url = :avatar_url, avatar_id = 'custom' WHERE id = :id");
                    $fullUrl = "uploads/avatars/" . $newFileName; // Relative path for frontend to prepend API_URL
                    
                    if($stmt->execute([':avatar_url' => $fullUrl, ':id' => $user_id])) {
                         http_response_code(200);
                         echo json_encode(array(
                             "message" => "Avatar uploaded successfully.",
                             "avatar_url" => $fullUrl,
                             "avatar_id" => "custom"
                         ));
                    } else {
                         http_response_code(500);
                         echo json_encode(array("message" => "Failed to update database."));
                    }

                } catch (PDOException $e) {
                    http_response_code(500);
                    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
                }
            } else {
                 http_response_code(500);
                 echo json_encode(array("message" => "Failed to move uploaded file."));
            }
        } else {
            http_response_code(400);
            echo json_encode(array("message" => "File is too large. Max 5MB."));
        }
    } else {
        http_response_code(400);
        echo json_encode(array("message" => "Invalid file type. Allowed: jpg, jpeg, png, gif, webp."));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Error uploading file. Code: " . $fileError));
}
?>
