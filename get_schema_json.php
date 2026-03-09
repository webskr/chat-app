<?php
include_once 'backend/includes/db_connection.php';

function getTableStructure($pdo, $tableName) {
    try {
        $stmt = $pdo->query("DESCRIBE $tableName");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        return ["error" => $e->getMessage()];
    }
}

$result = [
    "groups" => getTableStructure($pdo, 'groups'),
    "group_members" => getTableStructure($pdo, 'group_members')
];

echo json_encode($result, JSON_PRETTY_PRINT);
?>
