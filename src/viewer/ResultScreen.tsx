import { useEffect, useMemo, useRef, useState } from 'react';
import ImageViewer, { type ViewerHandle, type ViewerMode } from './ImageViewer';
import DebugPanel from '../ui/DebugPanel';
import {
  CheckIcon,
  CropIcon,
  RedoIcon,
  RotateIcon,
  RulerIcon,
  SaveIcon,
  ShareIcon,
  StraightenIcon,
} from '../ui/Icons';
import {
  estimateAccuracy,
  formatLength,
  newId,
  pixelDistance,
  toCm,
  type Calibration,
  type LabelledMeasurement,
  type Measurement,
  type Point,
  type Unit,
} from '../measure/measurements';
import { canShareFiles, fileNameFor, renderExport, saveBlob, shareBlob, type ExportFormat } from './exportImage';
import { clampRect, rectToRotated, rotatedBounds } from './geometry';
import type { StitchResult } from '../stitch';
import type { Rect } from '../stitch/render';

interface Props {
  result: StitchResult;
  debug: boolean;
  onRedo: () => void;
  onNew: () => void;
}

type Sheet = 'quality' | 'calibrate' | 'label' | 'straighten' | 'export' | 'measurements' | null;

const QUICK_TITLES = ['Total length', 'Width', 'Hole diameter', 'Spacing', 'Thickness'];

export default function ResultScreen({ result, debug, onRedo, onNew }: Props) {
  const viewerRef = useRef<ViewerHandle | null>(null);
  const [mode, setMode] = useState<ViewerMode>('view');
  const [sheet, setSheet] = useState<Sheet>('quality');
  const [name, setName] = useState(() => `Scan ${new Date().toLocaleDateString()}`);
  const [unit, setUnit] = useState<Unit>('cm');
  const [quarterTurns, setQuarterTurns] = useState(0);
  const [fineAngle, setFineAngle] = useState(0);
  const [requestedCrop, setCrop] = useState<Rect>(result.crop);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [pending, setPending] = useState<Point[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [referenceValue, setReferenceValue] = useState('16');
  const [referenceUnit, setReferenceUnit] = useState<Unit>('cm');
  const [labelTitle, setLabelTitle] = useState('');
  const [format, setFormat] = useState<ExportFormat>('png');
  const [burnIn, setBurnIn] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const angle = (quarterTurns * Math.PI) / 2 + (fineAngle * Math.PI) / 180;
  const bounds = useMemo(
    () => rotatedBounds(result.canvas.width, result.canvas.height, angle),
    [result.canvas, angle],
  );

  // The crop lives in rotated space, so turning the image can push it out of
  // range. Clamping on read keeps the stored rectangle as the user drew it.
  const crop = useMemo(() => clampRect(requestedCrop, bounds), [requestedCrop, bounds]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const labelled: LabelledMeasurement[] = useMemo(
    () =>
      measurements.map((measurement) => ({
        ...measurement,
        label: describe(measurement, calibration, unit),
      })),
    [measurements, calibration, unit],
  );

  const accuracy = useMemo(
    () => estimateAccuracy(result.quality.grade, calibration, result.plan.outputScale),
    [result.quality.grade, calibration, result.plan.outputScale],
  );

  const enterMode = (next: ViewerMode) => {
    setPending([]);
    setSelectedId(null);
    if (next === 'measure' && !calibration) {
      setMode('calibrate');
      setSheet('calibrate');
      return;
    }
    setMode(next);
    setSheet(null);
  };

  const placePoint = (point: Point) => {
    const next = [...pending, point];
    if (next.length < 2) {
      setPending(next);
      return;
    }
    setPending(next);
    setSheet(mode === 'calibrate' ? 'calibrate' : 'label');
  };

  const applyCalibration = () => {
    const value = Number.parseFloat(referenceValue.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0 || pending.length < 2) return;
    const cm = referenceUnit === 'mm' ? value / 10 : value;
    const pixels = pixelDistance(pending[0], pending[1]);
    if (pixels < 4) {
      setToast('Those two points are too close together to calibrate from.');
      return;
    }
    setCalibration({ pixelsPerCm: pixels / cm, referenceCm: cm, a: pending[0], b: pending[1] });
    setPending([]);
    setSheet(null);
    setMode('measure');
    setToast(`Calibrated: ${(pixels / cm).toFixed(1)} px per cm`);
  };

  const applyLabel = () => {
    if (pending.length < 2) return;
    const measurement: Measurement = { id: newId(), a: pending[0], b: pending[1], title: labelTitle.trim() };
    setMeasurements((current) => [...current, measurement]);
    setSelectedId(measurement.id);
    setPending([]);
    setLabelTitle('');
    setSheet(null);
  };

  const moveEndpoint = (id: string, endpoint: 'a' | 'b', point: Point) => {
    setMeasurements((current) =>
      current.map((measurement) => (measurement.id === id ? { ...measurement, [endpoint]: point } : measurement)),
    );
  };

  const resetCrop = () => {
    setCrop(clampRect(rectToRotated(result.crop, result.canvas.width, result.canvas.height, angle), bounds));
  };

  const doExport = async (share: boolean) => {
    setBusy(share ? 'Preparing to share…' : 'Saving image…');
    try {
      const exported = await renderExport({
        mosaic: result.canvas,
        angle,
        crop,
        measurements: labelled,
        calibration,
        includeAnnotations: burnIn,
        format,
      });
      const filename = fileNameFor(name, format);
      if (share) {
        const shared = canShareFiles(exported.blob, filename) && (await shareBlob(exported.blob, filename, name));
        if (!shared) {
          saveBlob(exported.blob, filename);
          setToast('Sharing is unavailable here — the image was saved instead.');
        }
      } else {
        saveBlob(exported.blob, filename);
        setToast(`Saved ${filename} — ${exported.width} × ${exported.height} px`);
      }
      setSheet(null);
    } catch (error) {
      setToast((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const hint =
    mode === 'calibrate'
      ? pending.length === 0
        ? 'Tap the first reference point'
        : pending.length === 1
          ? 'Tap the second reference point'
          : 'Enter the real distance'
      : mode === 'measure'
        ? pending.length === 0
          ? 'Tap where the measurement starts'
          : pending.length === 1
            ? 'Tap where it ends'
            : 'Name the measurement'
        : mode === 'crop'
          ? 'Drag the corners to crop'
          : null;

  return (
    <div className="screen result">
      <div className="result-top">
        <input
          className="title-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Scan name"
        />
        <span className={`badge ${result.quality.grade.toLowerCase()}`} onClick={() => setSheet('quality')}>
          {result.quality.grade}
        </span>
        <button className="icon-btn light" onClick={() => viewerRef.current?.fit()} aria-label="Fit to screen">
          <span style={{ fontSize: 11, fontWeight: 700 }}>FIT</span>
        </button>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
        <ImageViewer
          handleRef={viewerRef}
          mosaic={result.canvas}
          angle={angle}
          crop={crop}
          mode={mode}
          measurements={labelled}
          calibration={calibration}
          pending={pending}
          unit={unit}
          selectedId={selectedId}
          onCropChange={setCrop}
          onPlacePoint={placePoint}
          onMoveEndpoint={moveEndpoint}
          onSelect={setSelectedId}
        />
        {hint ? <div className="hint-bar">{hint}</div> : null}
        {toast ? <div className="toast-bar">{toast}</div> : null}
        {mode !== 'view' ? (
          <button
            className="btn btn-sm btn-primary"
            style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 3 }}
            onClick={() => {
              setMode('view');
              setPending([]);
            }}
          >
            <CheckIcon size={16} /> Done
          </button>
        ) : null}
      </div>

      <div className="toolbar">
        <button className={`tool${mode === 'measure' || mode === 'calibrate' ? ' active' : ''}`} onClick={() => enterMode('measure')}>
          <RulerIcon />
          {calibration ? 'Measure' : 'Calibrate'}
        </button>
        <button className="tool" onClick={() => setSheet('measurements')}>
          <span style={{ fontSize: 20, fontWeight: 700, lineHeight: '20px' }} className="numeric">
            {measurements.length}
          </span>
          List
        </button>
        <button className={`tool${mode === 'crop' ? ' active' : ''}`} onClick={() => enterMode('crop')}>
          <CropIcon />
          Crop
        </button>
        <button className="tool" onClick={() => setQuarterTurns((turns) => (turns + 1) % 4)}>
          <RotateIcon />
          Rotate
        </button>
        <button className={`tool${fineAngle !== 0 ? ' active' : ''}`} onClick={() => setSheet('straighten')}>
          <StraightenIcon />
          Straighten
        </button>
        <button className="tool" onClick={onRedo}>
          <RedoIcon />
          Redo scan
        </button>
      </div>

      <div className="result-bottom">
        {debug ? (
          <DebugPanel
            className="light"
            title="Debug — stitch"
            rows={[
              ['frames kept', String(result.debug.frames)],
              ['frames rejected', String(result.debug.rejected)],
              ['pairs refined', `${result.debug.refinedPairs} (fallback ${result.debug.fallbackPairs})`],
              ['align size', `${result.debug.refineSize}px`],
              ['mean inliers', result.quality.metrics.meanInliers.toFixed(1)],
              ['min overlap', result.quality.metrics.minOverlap.toFixed(2)],
              ['max rotation', `${result.quality.metrics.maxRotationDeg.toFixed(1)}°`],
              ['straighten', `${result.debug.straightenDeg.toFixed(2)}°`],
              ['scale drift', result.debug.scaleDriftRemoved.toFixed(4)],
              ['refine ms', String(result.debug.refineMs)],
              ['render ms', String(result.debug.renderMs)],
              ['total ms', String(result.debug.totalMs)],
              ['output scale', `${(result.debug.outputScale * 100).toFixed(0)}%`],
              ['mosaic', `${result.canvas.width} × ${result.canvas.height}`],
              ['crop', `${Math.round(crop.width)} × ${Math.round(crop.height)}`],
              ['source frames', result.debug.sourceFrameSize],
              ['heap MB', result.debug.memoryMb === null ? 'n/a' : String(result.debug.memoryMb)],
            ]}
          />
        ) : null}
        <div className="btn-row">
          <button className="btn btn-accent" onClick={() => setSheet('export')} disabled={!!busy}>
            <SaveIcon size={18} /> Save Image
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setFormat('jpeg');
              void doExport(true);
            }}
            disabled={!!busy}
          >
            <ShareIcon size={18} /> Share
          </button>
        </div>
        <button className="btn btn-quiet" onClick={onNew}>
          New Scan
        </button>
      </div>

      {sheet ? (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(event) => event.stopPropagation()}>
            <div className="grabber" />
            {sheet === 'quality' ? (
              <QualitySheet result={result} accuracy={accuracy.text} onClose={() => setSheet(null)} />
            ) : null}

            {sheet === 'calibrate' ? (
              <>
                <h3>Calibrate measurements</h3>
                <p>
                  Tap two points you know the real distance between — two holes, the ends of a ruler, a printed
                  mark — then enter that distance.
                </p>
                {pending.length < 2 ? (
                  <div className="notice info">
                    Close this sheet and tap the two reference points on the image.
                    {pending.length === 1 ? ' One point placed.' : ''}
                  </div>
                ) : (
                  <>
                    <div className="field">
                      <label htmlFor="reference">Real distance between the two points</label>
                      <div className="field-row">
                        <input
                          id="reference"
                          type="number"
                          inputMode="decimal"
                          value={referenceValue}
                          onChange={(event) => setReferenceValue(event.target.value)}
                        />
                        <div className="seg" style={{ flex: '0 0 116px' }}>
                          <button className={referenceUnit === 'cm' ? 'on' : ''} onClick={() => setReferenceUnit('cm')}>
                            cm
                          </button>
                          <button className={referenceUnit === 'mm' ? 'on' : ''} onClick={() => setReferenceUnit('mm')}>
                            mm
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="btn-row">
                      <button className="btn btn-ghost" onClick={() => setPending([])}>
                        Pick again
                      </button>
                      <button className="btn btn-accent" onClick={applyCalibration}>
                        Set scale
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : null}

            {sheet === 'label' ? (
              <>
                <h3>Add measurement</h3>
                <p className="numeric">
                  {pending.length === 2 && calibration
                    ? formatLength(toCm(pixelDistance(pending[0], pending[1]), calibration), unit)
                    : ''}
                </p>
                <div className="field">
                  <label htmlFor="title">Name (optional)</label>
                  <input
                    id="title"
                    type="text"
                    value={labelTitle}
                    placeholder="e.g. Total length"
                    onChange={(event) => setLabelTitle(event.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                  {QUICK_TITLES.map((title) => (
                    <button key={title} className="btn btn-sm btn-ghost" onClick={() => setLabelTitle(title)}>
                      {title}
                    </button>
                  ))}
                </div>
                <div className="btn-row">
                  <button className="btn btn-ghost" onClick={() => { setPending([]); setSheet(null); }}>
                    Cancel
                  </button>
                  <button className="btn btn-accent" onClick={applyLabel}>
                    Add
                  </button>
                </div>
              </>
            ) : null}

            {sheet === 'measurements' ? (
              <>
                <h3>Measurements</h3>
                <p>
                  {calibration
                    ? `Scale: ${calibration.pixelsPerCm.toFixed(1)} px per cm · estimated accuracy ${accuracy.text}`
                    : 'Not calibrated yet.'}
                </p>
                <div className="seg" style={{ marginBottom: 12 }}>
                  <button className={unit === 'cm' ? 'on' : ''} onClick={() => setUnit('cm')}>
                    Centimetres
                  </button>
                  <button className={unit === 'mm' ? 'on' : ''} onClick={() => setUnit('mm')}>
                    Millimetres
                  </button>
                </div>
                {labelled.length ? (
                  <div className="measure-list">
                    {labelled.map((measurement) => (
                      <div className="measure-item" key={measurement.id}>
                        <span className="swatch" />
                        <span>{measurement.title || 'Measurement'}</span>
                        <strong className="numeric">
                          {calibration ? formatLength(toCm(pixelDistance(measurement.a, measurement.b), calibration), unit) : '—'}
                        </strong>
                        <button
                          className="btn btn-sm btn-quiet"
                          onClick={() => setMeasurements((current) => current.filter((item) => item.id !== measurement.id))}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="notice info">No measurements yet. Use the Measure tool to add one.</div>
                )}
                <div className="btn-row" style={{ marginTop: 14 }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setMeasurements([]);
                      setCalibration(null);
                    }}
                    disabled={!measurements.length && !calibration}
                  >
                    Clear all
                  </button>
                  <button className="btn btn-primary" onClick={() => { setSheet(null); enterMode('measure'); }}>
                    Add measurement
                  </button>
                </div>
                <p style={{ marginTop: 14, fontSize: 13 }}>{accuracy.detail}</p>
              </>
            ) : null}

            {sheet === 'straighten' ? (
              <>
                <h3>Straighten</h3>
                <p>Fine-tune the angle. The stitcher already levelled the object by {result.debug.straightenDeg.toFixed(1)}°.</p>
                <input
                  type="range"
                  min={-15}
                  max={15}
                  step={0.1}
                  value={fineAngle}
                  onChange={(event) => setFineAngle(Number(event.target.value))}
                  style={{ width: '100%' }}
                />
                <div className="scan-meta" style={{ color: 'var(--ink-500)' }}>
                  <span className="numeric">{fineAngle.toFixed(1)}°</span>
                  <button className="btn btn-sm btn-quiet" onClick={() => setFineAngle(0)}>
                    Reset
                  </button>
                </div>
                <div className="btn-row" style={{ marginTop: 14 }}>
                  <button className="btn btn-ghost" onClick={resetCrop}>
                    Reset crop
                  </button>
                  <button className="btn btn-primary" onClick={() => setSheet(null)}>
                    Done
                  </button>
                </div>
              </>
            ) : null}

            {sheet === 'export' ? (
              <>
                <h3>Save image</h3>
                <p className="numeric">
                  {Math.round(crop.width)} × {Math.round(crop.height)} px
                  {result.plan.outputScale < 1 ? ` · ${(result.plan.outputScale * 100).toFixed(0)}% of camera resolution` : ' · full camera resolution'}
                </p>
                <div className="seg" style={{ marginBottom: 12 }}>
                  <button className={format === 'png' ? 'on' : ''} onClick={() => setFormat('png')}>
                    PNG
                  </button>
                  <button className={format === 'jpeg' ? 'on' : ''} onClick={() => setFormat('jpeg')}>
                    JPEG
                  </button>
                </div>
                <label className="measure-item" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={burnIn} onChange={(event) => setBurnIn(event.target.checked)} />
                  Include measurement annotations
                </label>
                <div className="btn-row" style={{ marginTop: 14 }}>
                  <button className="btn btn-ghost" onClick={() => void doExport(true)} disabled={!!busy}>
                    Share
                  </button>
                  <button className="btn btn-accent" onClick={() => void doExport(false)} disabled={!!busy}>
                    {busy ?? 'Save'}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function describe(measurement: Measurement, calibration: Calibration | null, unit: Unit): string {
  const pixels = pixelDistance(measurement.a, measurement.b);
  const value = calibration ? formatLength(toCm(pixels, calibration), unit) : `${Math.round(pixels)} px`;
  return measurement.title ? `${measurement.title}: ${value}` : value;
}

function QualitySheet({
  result,
  accuracy,
  onClose,
}: {
  result: StitchResult;
  accuracy: string;
  onClose: () => void;
}) {
  const { quality } = result;
  return (
    <>
      <h3>Scan quality</h3>
      <p>
        <span className={`badge ${quality.grade.toLowerCase()}`}>{quality.grade}</span>{' '}
        <span className="numeric" style={{ marginLeft: 8 }}>
          {quality.score}/100
        </span>
      </p>
      {result.warnings.map((warning) => (
        <div className="notice warn" key={warning} style={{ marginBottom: 8 }}>
          {warning}
        </div>
      ))}
      <ul className="list">
        {quality.issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
      {quality.advice.length ? (
        <>
          <p style={{ marginTop: 12, marginBottom: 4, fontWeight: 600, color: 'var(--ink-900)' }}>
            To improve the next scan
          </p>
          <ul className="list">
            {quality.advice.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}
      <div className="stat-grid">
        <div className="stat">
          <span>Frames</span>
          <strong className="numeric">{result.debug.frames}</strong>
        </div>
        <div className="stat">
          <span>Mean matches</span>
          <strong className="numeric">{quality.metrics.meanInliers.toFixed(0)}</strong>
        </div>
        <div className="stat">
          <span>Min overlap</span>
          <strong className="numeric">{(quality.metrics.minOverlap * 100).toFixed(0)}%</strong>
        </div>
        <div className="stat">
          <span>Output</span>
          <strong className="numeric">
            {result.canvas.width}×{result.canvas.height}
          </strong>
        </div>
        <div className="stat">
          <span>Measure accuracy</span>
          <strong className="numeric">{accuracy}</strong>
        </div>
        <div className="stat">
          <span>Stitch time</span>
          <strong className="numeric">{(result.debug.totalMs / 1000).toFixed(1)}s</strong>
        </div>
      </div>
      <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={onClose}>
        Continue
      </button>
    </>
  );
}
