<?php
// backend/cron/process_scheduled_messages.php

include_once __DIR__ . '/../includes/db_connection.php';
include_once __DIR__ . '/../chat/scheduled_message_service.php';

header("Content-Type: text/plain");

// Call the shared service
$result = processScheduledMessages($pdo);

if (!empty($result['errors'])) {
    echo "Errors occurred:\n";
    foreach ($result['errors'] as $error) {
        echo "- $error\n";
    }
}

echo "Processed {$result['count']} scheduled messages.\n";
?>
