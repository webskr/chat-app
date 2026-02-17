<?php
// backend/debug/test_date.php
header("Content-Type: text/plain");

$iso_date = "2026-02-17T15:30:00.000Z"; // Example JS toISOString()
$ts = strtotime($iso_date);

echo "Input: $iso_date\n";
echo "Timestamp: $ts\n";
echo "Formatted: " . gmdate('Y-m-d H:i:s', $ts) . "\n";
echo "Current UTC: " . gmdate('Y-m-d H:i:s') . "\n";

if ($ts) {
    echo "Parsing Successful.\n";
} else {
    echo "Parsing Failed.\n";
}
?>
