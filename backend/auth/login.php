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

if (!empty($data->email) && !empty($data->password)) {
    $email = trim($data->email);
    $password = $data->password;

    try {
        $query = "SELECT id, username, email, password, avatar_id FROM users WHERE email = :email LIMIT 0,1";
        $stmt = $pdo->prepare($query);

        $stmt->bindParam(':email', $email);
        $stmt->execute();
        $num = $stmt->rowCount();

        if ($num > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $id = $row['id'];
            $username = $row['username'];
            $email = $row['email'];
            $password_hash = $row['password'];
            $avatar_id = $row['avatar_id'];

            if (password_verify($password, $password_hash)) {
                http_response_code(200);
                ob_clean();
                echo json_encode(array(
                    "message" => "Login successful.",
                    "user" => array(
                        "id" => $id,
                        "username" => $username,
                        "email" => $email,
                        "avatar_id" => $avatar_id
                    )
                ));
            } else {
                http_response_code(401);
                echo json_encode(array("message" => "Login failed. Invalid password."));
            }
        } else {
            http_response_code(404);
            echo json_encode(array("message" => "Login failed. User not found."));
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Login failed. Data is incomplete."));
}
