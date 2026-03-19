<?php
header('Content-Type: application/json');
require_once '../config.php';

// Get JSON input
$data = json_decode(file_get_contents('php://input'), true);

$name = $data['name'] ?? '';
$email = $data['email'] ?? '';
$message = $data['message'] ?? '';
$user_id = $data['user_id'] ?? null;

if (empty($name) || empty($email) || empty($message)) {
    echo json_encode(['success' => false, 'message' => 'Please fill in all fields (Name, Email, Message).']);
    exit;
}

// Configuration
$to = 'draj88540@gmail.com'; // User provided email
$subject = "New Feedback from Vegram App: " . substr($message, 0, 30) . "...";
$headers = "From: no-reply@vegram.app\r\n";
$headers .= "Reply-To: $email\r\n";
$headers .= "X-Mailer: PHP/" . phpversion();
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

$body = "New Feedback Received:\n\n";
$body .= "Name: $name\n";
$body .= "Email: $email\n";
if ($user_id) {
    $body .= "User ID: $user_id\n";
}
$body .= "--------------------------------------------------\n\n";
$body .= "Message:\n$message\n";

// Attempt to send email
// Note: This requires a working SMTP server configured in php.ini or a library like PHPMailer
// For XAMPP localhost, 'mail()' works if valid sendmail path is set or if just logging to file.
if (mail($to, $subject, $body, $headers)) {
    echo json_encode(['success' => true, 'message' => 'Feedback sent via email.']);
} else {
    // If mail fails (common on localhost without SMTP), log it and return success for user experience
    // or return error if strict. We'll return success but note it's logged.
    error_log("Failed to send feedback email. Content: " . print_r($data, true));
    
    // In a real production app, you might want to save to DB as backup.
    // For now, we simulate success for the UI if mail() returns false (often strictly config issue).
    // Or return error if you want to be honest. Let's return error to debug config if needed.
    // Actually, for user experience, better to save to DB -> then try email.
    // For this task, we will just echo success if we can't send mail locally? 
    // No, better to be honest.
    
    // FALLBACK: Save to a text file for localhost testing
    $log_entry = date('Y-m-d H:i:s') . " | From: $email | Msg: $message\n";
    file_put_contents('../feedback_log.txt', $log_entry, FILE_APPEND);
    
    echo json_encode(['success' => true, 'message' => 'Feedback recorded (Localhost Log).']);
}
?>
