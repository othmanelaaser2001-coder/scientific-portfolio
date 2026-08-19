import { useCallback, useEffect, useState } from 'react';
import ScannerScreen from './scan/ScannerScreen';
import ResultScreen from './viewer/ResultScreen';
import { stitchScan, type StitchProgress, type StitchResult } from './stitch';
import { clearScanFrames, clearStaleFrames } from './storage/frameStore';
import type { ScanCapture } from './scan/types';
import type { ScanSession } from './scan/session';
import { BugIcon, ScanIcon } from './ui/Icons';
import { useInstallPrompt } from './pwa/useInstallPrompt';

type Screen = 'home' | 'scanning' | 'processing' | 'result';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [debug, setDebug] = useState(false);
  const [progress, setProgress] = useState<StitchProgress>({ fraction: 0, label: '' });
  const [result, setResult] = useState<StitchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const install = useInstallPrompt();

  useEffect(() => {
    void clearStaleFrames(null);
  }, []);

  // A long scan is worth protecting from an accidental back-swipe or reload.
  useEffect(() => {
    if (screen === 'home') return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [screen]);

  // Releasing the mosaic canvas matters: a long scan can hold hundreds of
  // megabytes, and nothing else drops it.
  const releaseResult = useCallback(() => {
    setResult((current) => {
      if (current) {
        current.canvas.width = 0;
        current.canvas.height = 0;
      }
      return null;
    });
  }, []);

  const onFinished = useCallback(async (capture: ScanCapture, session: ScanSession) => {
    setScreen('processing');
    setError(null);
    setProgress({ fraction: 0, label: 'Reading captured frames' });
    try {
      const stitched = await stitchScan(capture, setProgress);
      setResult(stitched);
      setScreen('result');
    } catch (stitchError) {
      setError((stitchError as Error).message);
      setScreen('home');
    } finally {
      // The full-resolution frames have served their purpose.
      await clearScanFrames(capture.scanId);
      await session.dispose(true);
    }
  }, []);

  return (
    <div className="app">
      {screen === 'home' ? (
        <div className="screen home">
          <div className="home-head">
            <div className="brand">
              <span className="brand-mark">
                <ScanIcon size={15} />
              </span>
              Abderrahmane Scanner
            </div>
            <button
              className={`icon-btn light${debug ? ' on' : ''}`}
              onClick={() => setDebug((value) => !value)}
              aria-label="Toggle debug mode"
            >
              <BugIcon size={18} />
            </button>
          </div>

          <div className="home-body">
            <h1>Scan Long Object</h1>
            <p className="lede">
              Sweep the phone along a strap, belt, moulding or rule. Frames are captured automatically and stitched
              into one continuous, high-resolution image you can measure.
            </p>
            <ol className="steps">
              <li>
                <b>1</b>
                <span>Line the start of the object up inside the guide.</span>
              </li>
              <li>
                <b>2</b>
                <span>Move slowly along it — left to right, or top to bottom. No need to press anything.</span>
              </li>
              <li>
                <b>3</b>
                <span>Press Finish Scan, then calibrate once to read real distances.</span>
              </li>
            </ol>
            {error ? <div className="notice bad">{error}</div> : null}
            {install.iosHint ? (
              <div className="notice info">
                Install this app: tap Share in Safari, then <b>Add to Home Screen</b>. Everything stays on your phone.
              </div>
            ) : null}
          </div>

          <div className="home-foot">
            <button className="btn btn-primary" onClick={() => setScreen('scanning')}>
              <ScanIcon size={19} /> Start Scan
            </button>
            {install.canInstall ? (
              <button className="btn btn-ghost" onClick={() => void install.install()}>
                Install app
              </button>
            ) : null}
            <p style={{ margin: 0, textAlign: 'center', fontSize: 12.5, color: 'var(--ink-500)' }}>
              Works offline. Images are processed on this device and never uploaded.
            </p>
          </div>
        </div>
      ) : null}

      {screen === 'scanning' ? (
        <ScannerScreen
          debug={debug}
          onCancel={() => setScreen('home')}
          onFinished={(capture, session) => void onFinished(capture, session)}
        />
      ) : null}

      {screen === 'processing' ? (
        <div className="screen processing">
          <ProgressRing fraction={progress.fraction} />
          <div>
            <h2>Stitching your scan</h2>
            <p>{progress.label}</p>
          </div>
        </div>
      ) : null}

      {screen === 'result' && result ? (
        <ResultScreen
          result={result}
          debug={debug}
          onRedo={() => {
            releaseResult();
            setScreen('scanning');
          }}
          onNew={() => {
            releaseResult();
            setScreen('home');
          }}
        />
      ) : null}
    </div>
  );
}

function ProgressRing({ fraction }: { fraction: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <div className="ring">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="5" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="#22d39a"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset 220ms cubic-bezier(0.22,0.61,0.36,1)' }}
        />
      </svg>
      <div className="ring-label numeric">{Math.round(clamped * 100)}%</div>
    </div>
  );
}
