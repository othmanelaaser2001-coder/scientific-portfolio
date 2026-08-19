import { useEffect, useRef, useState } from 'react';
import { ScanSession } from './session';
import { GUIDANCE_TEXT, type Guidance, type LiveState, type ScanCapture } from './types';
import { BoltIcon, CloseIcon } from '../ui/Icons';
import DebugPanel from '../ui/DebugPanel';

interface Props {
  debug: boolean;
  onCancel: () => void;
  onFinished: (capture: ScanCapture, session: ScanSession) => void;
}

const TONE: Record<Guidance, 'good' | 'warn' | 'bad' | 'neutral'> = {
  position: 'neutral',
  'start-moving': 'neutral',
  good: 'good',
  'slow-down': 'warn',
  'hold-steady': 'warn',
  'move-back': 'bad',
  'low-overlap': 'bad',
  lost: 'bad',
  budget: 'warn',
  complete: 'good',
};

export default function ScannerScreen({ debug, onCancel, onFinished }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ghostRef = useRef<HTMLCanvasElement | null>(null);
  const stripRef = useRef<HTMLCanvasElement | null>(null);
  const sessionRef = useRef<ScanSession | null>(null);
  const [state, setState] = useState<LiveState | null>(null);
  const [ghostOn, setGhostOn] = useState(true);
  const ghostOnRef = useRef(true);
  ghostOnRef.current = ghostOn;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const session = new ScanSession(video);
    sessionRef.current = session;
    const unsubscribe = session.subscribe(setState);
    let raf = 0;

    void session.start().catch(() => undefined);

    const paint = () => {
      raf = requestAnimationFrame(paint);
      const ghost = ghostRef.current;
      const strip = stripRef.current;
      if (ghost) {
        const width = ghost.clientWidth;
        const height = ghost.clientHeight;
        if (width && (ghost.width !== width || ghost.height !== height)) {
          ghost.width = width;
          ghost.height = height;
        }
        if (ghostOnRef.current) session.drawGhost(ghost);
        else ghost.getContext('2d')?.clearRect(0, 0, ghost.width, ghost.height);
      }
      if (strip) {
        const width = Math.round(strip.clientWidth * Math.min(2, window.devicePixelRatio || 1));
        const height = Math.round(strip.clientHeight * Math.min(2, window.devicePixelRatio || 1));
        if (width && (strip.width !== width || strip.height !== height)) {
          strip.width = width;
          strip.height = height;
        }
        session.renderStripInto(strip);
      }
    };
    raf = requestAnimationFrame(paint);

    return () => {
      cancelAnimationFrame(raf);
      unsubscribe();
      // Temporary frames are deleted unless the scan was handed to the stitcher.
      void session.dispose(!session.handedOver);
      sessionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = async () => {
    const session = sessionRef.current;
    if (!session) return;
    const capture = await session.finish();
    session.handedOver = true;
    session.releaseCamera();
    onFinished(capture, session);
  };

  const phase = state?.phase ?? 'starting';
  const guidance = state?.guidance ?? 'position';
  const tone = TONE[guidance];
  const frames = state?.frames ?? 0;
  const vertical = state?.direction === 'vertical';

  if (phase === 'error') {
    return (
      <div className="screen scanner">
        <div className="error-box">
          <h2 style={{ margin: 0, fontSize: 22 }}>{state?.error}</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.5 }}>{state?.errorHint}</p>
          <button className="btn btn-ghost" onClick={onCancel}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen scanner">
      <div className="stage">
        <video ref={videoRef} playsInline muted autoPlay />
        <canvas ref={ghostRef} className="ghost" />
        <div className="stage-vignette" />
        <div className={`guide${vertical ? ' vertical' : ''}`}>
          <span className="guide-corner tl" />
          <span className="guide-corner tr" />
          <span className="guide-corner bl" />
          <span className="guide-corner br" />
          <span className="guide-axis" />
        </div>
      </div>

      <div className="scan-top">
        <button className="icon-btn" onClick={onCancel} aria-label="Cancel scan">
          <CloseIcon />
        </button>
        <div className="pill neutral numeric">
          {frames} {frames === 1 ? 'frame' : 'frames'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`icon-btn${ghostOn ? ' on' : ''}`}
            onClick={() => setGhostOn((value) => !value)}
            aria-label="Toggle overlap ghost"
          >
            <span style={{ fontSize: 12, fontWeight: 700 }}>OL</span>
          </button>
          {state?.torchSupported ? (
            <button
              className={`icon-btn${state.torchOn ? ' on' : ''}`}
              onClick={() => void sessionRef.current?.setTorch(!state.torchOn)}
              aria-label="Toggle torch"
            >
              <BoltIcon />
            </button>
          ) : null}
        </div>
      </div>

      <div className="guidance-slot">
        <div className={`pill ${tone}`} key={guidance}>
          <span className="pill-dot" />
          {GUIDANCE_TEXT[guidance]}
        </div>
      </div>

      {debug && state ? (
        <DebugPanel
          title="Debug — live"
          rows={[
            ['captured', String(state.frames)],
            ['rejected', String(state.rejected)],
            ['tracking drops', String(state.drops)],
            ['overlap', state.overlap.toFixed(3)],
            ['sharpness', `${state.sharpness.toFixed(1)} (${(state.sharpnessRatio * 100).toFixed(0)}%)`],
            ['matches', String(state.matches)],
            ['inliers', String(state.inliers)],
            ['keypoints', String(state.keypoints)],
            ['confidence', state.confidence.toFixed(2)],
            ['speed fw/s', state.speed.toFixed(2)],
            ['advance fw', state.advance.toFixed(1)],
            ['worker ms', state.workerMs.toFixed(1)],
            ['probe hz', state.probeHz.toFixed(1)],
            ['source', `${state.captureWidth}x${state.captureHeight}`],
          ]}
        />
      ) : null}

      <div className="scan-bottom">
        <div className="strip-wrap">
          <div className="strip-head">
            <span>Scanned so far</span>
            <span className="numeric">{state ? `${state.advance.toFixed(1)}× frame width` : ''}</span>
          </div>
          {frames > 0 ? (
            <canvas ref={stripRef} className="strip-canvas" />
          ) : (
            <div className="strip-empty">The scanned strip builds up here</div>
          )}
        </div>

        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${Math.min(100, (state?.coverage ?? 0) * 100).toFixed(1)}%` }}
          />
        </div>
        <div className="scan-meta">
          <span>
            {frames} of {sessionRef.current?.maxFrames ?? 140} frames used
          </span>
          <span>{state?.direction === 'vertical' ? 'Top → bottom' : 'Left → right'}</span>
        </div>

        <div className="shutter-row">
          {phase === 'ready' ? (
            <button className="btn btn-start-scan" onClick={() => sessionRef.current?.beginScanning()}>
              Start moving
            </button>
          ) : (
            <button className="btn btn-finish" onClick={() => void finish()} disabled={frames < 1}>
              Finish Scan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
