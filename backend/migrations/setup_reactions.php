<?php
include_once '../includes/db_connection.php';

try {
    $sql = "CREATE TABLE IF NOT EXISTS reactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT NOT NULL,
        user_id INT NOT NULL,
        emoji VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_reaction (message_id, user_id, emoji),
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )";
    $pdo->exec($sql);
    echo json_encode(["message" => "Reactions table created successfully."]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["message" => "Error creating table: " . $e->getMessage()]);
}
?>
