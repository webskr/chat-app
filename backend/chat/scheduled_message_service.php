<?php
// backend/chat/scheduled_message_service.php

function processScheduledMessages($pdo) {
    try {
        if (!$pdo->inTransaction()) {
            $pdo->beginTransaction();
        }

        // 1. Select messages that are scheduled and due
        // We use FOR UPDATE to lock these rows and prevent double sending
        $query = "SELECT id, conversation_id, message_text, media_url, message_type
                  FROM messages 
                  WHERE status = 'scheduled' 
                  AND scheduled_at <= UTC_TIMESTAMP() 
                  LIMIT 50 
                  FOR UPDATE";

        $stmt = $pdo->prepare($query);
        $stmt->execute();
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $processedCount = count($messages);

        if ($processedCount > 0) {
            $ids = array_column($messages, 'id');
            // 2. Update status to 'sent'
            $inQuery = implode(',', array_fill(0, count($ids), '?'));
            $updateSql = "UPDATE messages SET status = 'sent', sent_at = NOW() WHERE id IN ($inQuery)";
            $updateStmt = $pdo->prepare($updateSql);
            $updateStmt->execute($ids);

            // 3. Update Conversation Last Message
            $conversationsToUpdate = [];
            foreach ($messages as $msg) {
                $conversationsToUpdate[$msg['conversation_id']] = $msg;
            }

            foreach ($conversationsToUpdate as $cid => $msg) {
                $previewText = $msg['message_text'];
                if (empty($previewText)) {
                    switch ($msg['message_type']) {
                        case 'image': $previewText = '📷 Image'; break;
                        case 'video': $previewText = '🎥 Video'; break;
                        case 'voice': $previewText = '🎤 Voice Message'; break;
                        case 'document': $previewText = '📄 Document'; break;
                        case 'gif': $previewText = '👾 GIF'; break;
                        case 'sticker': $previewText = '🧩 Sticker'; break;
                        default: $previewText = 'Sent a message'; break;
                    }
                }
                
                $convSql = "UPDATE conversations 
                            SET last_message = :msg, 
                                last_message_time = NOW() 
                            WHERE id = :cid";
                $convStmt = $pdo->prepare($convSql);
                $convStmt->execute([':msg' => $previewText, ':cid' => $cid]);
            }
        }

        $pdo->commit();
        return ['count' => $processedCount, 'errors' => []];

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        return ['count' => 0, 'errors' => [$e->getMessage()]];
    }
}
?>
