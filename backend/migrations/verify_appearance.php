<?php
include_once '../includes/db_connection.php';

$user_id = 1; // Assuming user ID 1 exists
$border_color = '#TestBorder';
$button_color = '#TestButton';

// Simulate POST request payload
$data = json_encode([
    'user_id' => $user_id,
    'border_color' => $border_color,
    'button_color' => $button_color
]);

// Call the update logic (we can't include the file directly due to headers/input reading, so we'll just replicate the DB update logic here for testing)
// OR better, we can use curl to hit the endpoint if the server is running. 
// Since we don't know if the server is running, let's just test the DB connection and Column existence.

try {
    // Check columns
    $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'border_color'");
    $hasBorder = $stmt->fetch();
    
    $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'button_color'");
    $hasButton = $stmt->fetch();

    if ($hasBorder && $hasButton) {
        echo "Columns exist.\n";
        
        // Test Update
        $sql = "UPDATE users SET border_color = :bc, button_color = :btn WHERE id = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':bc' => $border_color, ':btn' => $button_color, ':id' => $user_id]);
        
        echo "Update executed.\n";
        
        // Verify Update
        $stmt = $pdo->prepare("SELECT border_color, button_color FROM users WHERE id = :id");
        $stmt->execute([':id' => $user_id]);
        $row = $stmt->fetch();
        
        echo "Border: " . $row['border_color'] . "\n";
        echo "Button: " . $row['button_color'] . "\n";
        
    } else {
        echo "Columns missing.\n";
    }

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
