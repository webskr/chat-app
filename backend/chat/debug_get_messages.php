<?php
// Test script for get_messages.php
$_GET['group_id'] = 1; // Assume group_id 1 exists and user is member
$_GET['sender_id'] = 1; // Assume user_id 1 exists

ob_start();
include 'get_messages.php';
$output = ob_get_clean();

echo "--- OUTPUT START ---\n";
echo $output;
echo "\n--- OUTPUT END ---\n";

// Check for JSON errors
$json = json_decode($output);
if (json_last_error() !== JSON_ERROR_NONE) {
    echo "JSON Error: " . json_last_error_msg();
}
?>
