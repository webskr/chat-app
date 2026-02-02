<?php
$url = 'http://localhost/chat-app/backend/chat/get_messages.php?sender_id=1&receiver_id=15';
$result = file_get_contents($url);

if ($result === FALSE) {
    echo "ERROR: Request failed.\n";
} else {
    echo "RESPONSE: " . $result . "\n";
}
?>
