import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { ChatLockService } from '../../../../utils/ChatLockService';

export const useChatLock = (id: string | undefined) => {
    const [isLocked, setIsLocked] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showLockSetup, setShowLockSetup] = useState(false);
    const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
    const [lockPin, setLockPin] = useState('');
    const [unlockPin, setUnlockPin] = useState('');
    const [isCheckingLock, setIsCheckingLock] = useState(true);

    useEffect(() => {
        checkLockStatus();
    }, [id]);

    const checkLockStatus = async () => {
        if (!id) return;
        setIsCheckingLock(true);
        const locked = await ChatLockService.isChatLocked(String(id));
        setIsLocked(locked);
        setIsAuthenticated(!locked);
        setIsCheckingLock(false);
    };

    const handleConfirmLock = async () => {
        if (lockPin.length < 4) {
            Alert.alert('Error', 'PIN must be at least 4 digits');
            return;
        }
        await ChatLockService.lockChat(String(id), lockPin);
        setIsLocked(true);
        setIsAuthenticated(true);
        setShowLockSetup(false);
        setLockPin('');
        Alert.alert('Success', 'Chat locked successfully.');
    };

    const handleConfirmUnlock = async () => {
        const isValid = await ChatLockService.verifyPin(String(id), unlockPin);
        if (isValid) {
            await ChatLockService.unlockChat(String(id));
            setIsLocked(false);
            setIsAuthenticated(true);
            setShowUnlockPrompt(false);
            setUnlockPin('');
            Alert.alert('Success', 'Chat unlocked.');
        } else {
            Alert.alert('Error', 'Incorrect PIN');
            setUnlockPin('');
        }
    };

    const handleEntryUnlock = async () => {
        const isValid = await ChatLockService.verifyPin(String(id), unlockPin);
        if (isValid) {
            setIsAuthenticated(true);
            setUnlockPin('');
        } else {
            Alert.alert('Error', 'Incorrect PIN');
            setUnlockPin('');
        }
    };

    return {
        isLocked,
        setIsLocked,
        isAuthenticated,
        setIsAuthenticated,
        showLockSetup,
        setShowLockSetup,
        showUnlockPrompt,
        setShowUnlockPrompt,
        lockPin,
        setLockPin,
        unlockPin,
        setUnlockPin,
        isCheckingLock,
        checkLockStatus,
        handleConfirmLock,
        handleConfirmUnlock,
        handleEntryUnlock
    };
};
