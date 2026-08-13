import { useState, useEffect, useCallback } from 'react';

// Global variable to catch the beforeinstallprompt event even before React mounts
let globalDeferredPrompt: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa-prompt-available'));
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState<boolean>(false);

  useEffect(() => {
    // Check if already in standalone / installed mode
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsInstalled(isStandaloneMode);
    };

    checkStandalone();

    // Check if iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const handlePromptAvailable = () => {
      setDeferredPrompt(globalDeferredPrompt);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('pwa-prompt-available', handlePromptAvailable);
    window.addEventListener('pwa-installed', handleInstalled);

    return () => {
      window.removeEventListener('pwa-prompt-available', handlePromptAvailable);
      window.removeEventListener('pwa-installed', handleInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
          globalDeferredPrompt = null;
          return { success: true, outcome: 'accepted' };
        }
        return { success: false, outcome: 'dismissed' };
      } catch (err) {
        console.error('PWA install prompt error:', err);
      }
    }

    // If native prompt is not available, show the intuitive 1-tap installation guide modal
    setShowInstructionsModal(true);
    return { success: false, outcome: 'show_guide' };
  }, [deferredPrompt]);

  return {
    deferredPrompt,
    isInstalled,
    isIOS,
    canPromptDirectly: Boolean(deferredPrompt),
    showInstructionsModal,
    setShowInstructionsModal,
    triggerInstall,
  };
}
