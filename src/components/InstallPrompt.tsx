import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Share, Plus, Smartphone, CheckCircle2, Sparkles } from 'lucide-react';

interface InstallPromptProps {
  onNotifyTriggered?: (msg: string) => void;
}

export function InstallPrompt({ onNotifyTriggered }: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    // 1. Check if already installed
    const standsAlone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    
    setIsInstalled(standsAlone);

    // 2. Check if dismissed in this browser session/localStorage
    const dismissed = localStorage.getItem('car_driver_pwa_prompt_dismissed') === 'true';
    setIsDismissed(dismissed);

    // 3. Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIosDevice);

    // 4. Listen for browser install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent standard browser direct bar
      e.preventDefault();
      // Save prompt event
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      console.log('App was successfully installed!');
      setIsInstalled(true);
      setDeferredPrompt(null);
      if (onNotifyTriggered) {
        onNotifyTriggered('🎉 Thank you! Car & Driver has been successfully installed on your device.');
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [onNotifyTriggered]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Trigger standard native installation dialog
    deferredPrompt.prompt();

    // Await user's confirmation
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User installation decision: ${outcome}`);

    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    // Clear deferred prompt reference
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    // Persist user dismissal to avoid repeated annoying popups
    localStorage.setItem('car_driver_pwa_prompt_dismissed', 'true');
  };

  // If already installed, dismissed, or no prompt available (unless on iOS Safari), do not render
  const canShowNativePrompt = deferredPrompt !== null;
  const canShowIOSPrompt = isIOS && !isInstalled;

  if (isInstalled || isDismissed) {
    return null;
  }

  if (!canShowNativePrompt && !canShowIOSPrompt) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full bg-[#111827] text-white border-b border-neutral-800 z-[9999] relative"
        id="pwa-install-app-banner"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            <div className="p-2 bg-neutral-900 rounded-xl border border-neutral-800 shrink-0 shadow-md">
              <img src="/icon.svg" alt="App Logo" className="w-9 h-9 object-contain" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/10 font-sans">
                  STANDALONE APP
                </span>
                <span className="flex items-center gap-1 text-[9px] font-bold text-amber-400">
                  <Sparkles className="w-2.5 h-2.5" /> Premium Experience
                </span>
              </div>
              <h4 className="text-xs font-bold text-white tracking-tight mt-0.5 font-sans">
                Install Car & Driver Relief Services Web App
              </h4>
              <p className="text-[10px] text-neutral-400 leading-normal max-w-xl font-sans mt-0.5">
                {isIOS 
                  ? 'Access the fleet logistics portal instantly from your home screen with zero browser controls or browser tabs clutter.' 
                  : 'Launch in standalone fullscreen mode, access offline logs, and experience rapid desktop / mobile response times.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
            {isIOS ? (
              <div className="flex items-center gap-2.5 bg-neutral-900 border border-neutral-800 rounded-xl py-2 px-3.5 text-[11px] text-neutral-300 font-medium font-sans max-w-sm md:max-w-none">
                <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  Tap Safari's <span className="font-bold underline text-white">Share</span> button <Share className="inline-block w-3.5 h-3.5 text-neutral-200 mx-1 align-text-bottom" /> then select <span className="font-bold underline text-white">Add to Home Screen</span> <Plus className="inline-block w-3.5 h-3.5 text-neutral-200 mx-1 align-text-bottom" />
                </span>
              </div>
            ) : (
              <button
                onClick={handleInstallClick}
                id="btn-pwa-banner-install-confirm"
                className="px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-neutral-950 font-bold text-xs uppercase tracking-wider rounded-xl transition duration-200 shadow-md flex items-center justify-center gap-2 cursor-pointer border-0 w-full sm:w-auto"
              >
                <Download className="w-3.5 h-3.5" />
                Install App
              </button>
            )}

            <button
              onClick={handleDismiss}
              id="btn-pwa-banner-dismiss"
              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-xl transition cursor-pointer shrink-0 border-0"
              title="Maybe Later"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
