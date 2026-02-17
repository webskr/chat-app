<?php
$url = 'http://localhost/chat-app/backend/chat/send_broadcast.php';
$data = array(
    'sender_id' => '9993',
    'message' => 'Test Broadcast with Image ' . date('Y-m-d H:i:s'),
    'image_path' => 'http://localhost/chat-app/backend/uploads/107022026151000056109.png'
);

$options = array(
    'http' => array(
        'header'  => "Content-type: application/json\r\n",
        'method'  => 'POST',
        'content' => json_encode($data)
    )
);
$context  = stream_context_create($options);
$result = file_get_contents($url, false, $context);

if ($result === FALSE) {
    echo "Error sending request\n";
    print_r(error_get_last());
} else {
    echo "Response: " . $result . "\n";
}
?>
