<?php
// backend/test_push.php
header('Content-Type: text/html');
include_once 'includes/db_connection.php';
include_once 'includes/push_service.php';

$message = "";
$tokens = [];

// Fetch all users with tokens
try {
    $stmt = $pdo->query("SELECT id, username, device_token FROM users WHERE device_token IS NOT NULL AND device_token != ''");
    $tokens = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {
    $message = "Error fetching tokens: " . $e->getMessage();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $targetToken = $_POST['token'] ?? '';
    $title = $_POST['title'] ?? 'Test Notification';
    $body = $_POST['body'] ?? 'This is a test message from the backend.';
    
    if ($targetToken) {
        $data = ['type' => 'test', 'timestamp' => time()];
        // $result = sendPushNotification($targetToken, $title, $body, $data);
        
        // Inline debug sending logic
        $ch = curl_init("https://exp.host/--/api/v2/push/send");
        $payload = json_encode([
            'to' => $targetToken,
            'title' => $title,
            'body' => $body,
            'sound' => 'default',
            'priority' => 'high',
            'channelId' => 'default',
            'data' => $data
        ]);
        
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'Accept: application/json']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        $rawResponse = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $json = json_decode($rawResponse, true);
        $status = $json['data']['status'] ?? 'unknown';
        
        if ($httpCode === 200 && $status === 'ok') {
            $ticketId = $json['data']['id'] ?? 'N/A';
            $message = "<div style='color: green; padding: 10px; border: 1px solid green; margin-bottom: 20px;'>
                ✅ <strong>Expo Accepted:</strong> Ticket ID: $ticketId<br>
                <small>This means Expo received it. If not on device, check FCM credentials or device settings.</small>
            </div>";
        } else {
            $errorDetails = json_encode($json);
            $message = "<div style='color: red; padding: 10px; border: 1px solid red; margin-bottom: 20px;'>
                ❌ <strong>Expo Error:</strong><br>
                HTTP: $httpCode<br>
                Response: $errorDetails
            </div>";
        }
    }
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>Test Push Notifications</title>
    <style>
        body { font-family: sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; }
        select, input, button { padding: 10px; margin: 5px 0; width: 100%; box-sizing: border-box; }
        button { background: #007bff; color: white; border: none; cursor: pointer; }
        button:hover { background: #0056b3; }
        .user-row { padding: 10px; border-bottom: 1px solid #eee; }
    </style>
</head>
<body>
    <h1>🚀 Push Notification Tester</h1>
    
    <?php echo $message; ?>

    <form method="POST">
        <h3>1. Select Target User</h3>
        <?php if (empty($tokens)): ?>
            <p style="color: red;">⚠️ No devices registered in database yet. Login to the app first!</p>
        <?php else: ?>
            <select name="token" required>
                <?php foreach ($tokens as $user): ?>
                    <option value="<?php echo htmlspecialchars($user['device_token']); ?>">
                        <?php echo htmlspecialchars($user['username']); ?> (ID: <?php echo $user['id']; ?>)
                    </option>
                <?php endforeach; ?>
            </select>
        <?php endif; ?>

        <h3>2. Notification Details</h3>
        <input type="text" name="title" placeholder="Title" value="Test Notification" required>
        <input type="text" name="body" placeholder="Body" value="Hello! This is a test." required>

        <button type="submit">Send Notification</button>
    </form>

    <h3>Debug Info</h3>
    <p>Server Time: <?php echo date('Y-m-d H:i:s'); ?></p>
</body>
</html>
