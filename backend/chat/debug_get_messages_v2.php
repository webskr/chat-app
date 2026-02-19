<?php
// Test script for get_messages.php
$_GET['group_id'] = 2; 
$_GET['sender_id'] = 23; 

ob_start();
include 'get_messages.php';
$output = ob_get_clean();

echo "--- OUTPUT START ---\n";
echo $output;
echo "\n--- OUTPUT END ---\n";

// Check for JSON errors
// If get_messages.php exits, ob_get_clean might catch it, or not.
?>
