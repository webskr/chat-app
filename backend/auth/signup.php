<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../includes/db_connection.php';


$data = json_decode(file_get_contents("php://input"));

if (!empty($data->username) && !empty($data->email) && !empty($data->password)) {
    $username = trim($data->username);
    $email = trim($data->email);
    $password = $data->password;

    try {
        $avatar_id = (string)rand(0, 5);
        
        // Random Neon Color Generator for default appearance
        $neon_colors = [
            '#FF00FF', // Neon Magenta
            '#00FFFF', // Neon Cyan
            '#39FF14', // Neon Green
            '#FFE700', // Neon Yellow
            '#FF10F0', // Neon Pink
            '#BF00FF', // Electric Purple
            '#FF3131', // Neon Red
            '#1F51FF', // Neon Blue
            '#FF5F1F', // Neon Orange
        ];
        $random_color = $neon_colors[array_rand($neon_colors)];

        $query = "INSERT INTO users (username, email, password, avatar_id, border_color, button_color) VALUES (:username, :email, :password, :avatar_id, :border_color, :button_color)";
        $stmt = $pdo->prepare($query);

        $password_hash = password_hash($password, PASSWORD_BCRYPT);

        $stmt->bindParam(':username', $username);
        $stmt->bindParam(':email', $email);
        $stmt->bindParam(':password', $password_hash);
        $stmt->bindParam(':avatar_id', $avatar_id);
        $stmt->bindParam(':border_color', $random_color);
        $stmt->bindParam(':button_color', $random_color);

        if ($stmt->execute()) {
            http_response_code(201);
            ob_clean();
            echo json_encode(array("message" => "User was created."));
        } else {
            http_response_code(503);
            echo json_encode(array("message" => "Unable to create user."));
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Unable to create user. Data is incomplete."));
}
