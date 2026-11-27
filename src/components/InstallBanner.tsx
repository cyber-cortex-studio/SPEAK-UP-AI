import { useEffect, useState } from 'react';
import {
  clearDeferredPrompt,
  getDeferredPrompt,
  subscribePwaInstall,
  type BeforeInstallPromptEvent,
} from '../utils/pwaInstall';

const DISMISS_KEY = 'speakup_install_dismissed';

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return isStandaloneMedia || Boolean(nav.standalone);
}

function checkIsIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

function checkIsInAppBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  return /FBAN|FBAV|Instagram|WhatsApp|Line|Snapchat/i.test(window.navigator.userAgent);
}

function readDismissed(): boolean {
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    getDeferredPrompt()
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => checkIsStandalone());
  const [isDismissed, setIsDismissed] = useState<boolean>(() => readDismissed());
  const [showManualGuide, setShowManualGuide] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  const isIOS = checkIsIOS();
  const isInApp = checkIsInAppBrowser();

  useEffect(() => {
    const unsubscribe = subscribePwaInstall((promptEvent) => {
      setDeferredPrompt(promptEvent);
    });

    const handleAppInstalled = () => {
      setIsInstalled(true);
    };

    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      unsubscribe();
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (isInstalled || isDismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    const activePrompt = deferredPrompt ?? getDeferredPrompt();

    if (activePrompt) {
      setIsInstalling(true);
      try {
        await activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
        }
      } finally {
        clearDeferredPrompt();
        setIsInstalling(false);
      }
      return;
    }

    setShowManualGuide((prev) => !prev);
  };

  const handleDismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignore storage errors in restricted browsing modes
    }
    setIsDismissed(true);
  };

  return (
    <div className="sticky top-0 z-50 w-full px-3 pt-3 pb-1">
      <div className="mx-auto max-w-md rounded-2xl border border-emerald-500/40 bg-slate-900/95 p-3.5 shadow-xl shadow-emerald-950/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <img
            src="/icons/icon-192.png"
            alt="SpeakUp AI"
            className="h-12 w-12 shrink-0 rounded-xl border border-emerald-500/30 object-cover"
          />

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold text-white">
              Install SpeakUp AI
            </h2>
            <p className="text-xs text-slate-400">
              {deferredPrompt
                ? 'One-tap install for instant access'
                : 'Add to your home screen for the best experience'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close install banner"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        <button
          type="button"
          onClick={handleInstallClick}
          disabled={isInstalling}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition active:scale-[0.98] hover:bg-emerald-400 disabled:opacity-60"
        >
          <span>{isInstalling ? 'Installing...' : 'Install App'}</span>
        </button>

        {showManualGuide && (
          <div className="mt-2.5 rounded-xl border border-slate-700/80 bg-slate-950/90 p-3 text-xs leading-relaxed text-slate-300">
            {isIOS ? (
              <p>
                <strong className="text-emerald-400">Install on iPhone:</strong> Tap the{' '}
                <strong className="text-white">Share</strong> button in Safari, then select{' '}
                <strong className="text-white">Add to Home Screen</strong>.
              </p>
            ) : isInApp ? (
              <p>
                <strong className="text-emerald-400">In-App Browser Detected:</strong> Tap the{' '}
                <strong className="text-white">⋮</strong> menu in the top-right corner, select{' '}
                <strong className="text-white">Open in Chrome</strong>, and tap Install App again.
              </p>
            ) : (
              <p>
                <strong className="text-emerald-400">Quick Install:</strong> Tap the{' '}
                <strong className="text-white">⋮</strong> menu in the top-right corner of your browser
                and select <strong className="text-white">Install app</strong> (or Add to Home screen).
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
