/**
 * Guidance behaviour, in particular that a dropped frame does not immediately
 * tell the user to move back — the sampler drops frames constantly on real
 * hardware and that advice is usually wrong.
 */
import {
  GuidanceSmoother,
  GUIDANCE_HOLD_MS,
  LOST_STREAK_LIMIT,
  decideGuidance,
} from '../src/scan/guidance';
import { GUIDANCE_TEXT } from '../src/scan/types';
import type { Guidance } from '../src/scan/types';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

const nominal = {
  tracking: true,
  overlap: 0.8,
  sharpnessRatio: 1,
  speed: 0.2,
  budgetReached: false,
  lostStreak: 0,
  minOverlap: 0.3,
};

// A steady, well-lit sweep should just say Good.
check('steady sweep reads Good', decideGuidance(nominal) === 'good', GUIDANCE_TEXT[decideGuidance(nominal)]);

// One or two dropped frames must not produce "Move back slightly".
for (let streak = 1; streak < LOST_STREAK_LIMIT; streak++) {
  const guidance = decideGuidance({ ...nominal, tracking: false, lostStreak: streak });
  check(
    `dropout ${streak} does not say move back`,
    GUIDANCE_TEXT[guidance] !== 'Move back slightly',
    `"${GUIDANCE_TEXT[guidance]}"`,
  );
}

// Sustained loss of tracking should.
{
  const guidance = decideGuidance({ ...nominal, tracking: false, lostStreak: LOST_STREAK_LIMIT });
  check(
    'sustained loss does say move back',
    GUIDANCE_TEXT[guidance] === 'Move back slightly',
    `after ${LOST_STREAK_LIMIT} consecutive failures: "${GUIDANCE_TEXT[guidance]}"`,
  );
}

// Genuine loss of overlap while still tracking is reported straight away.
check(
  'lost overlap says move back',
  decideGuidance({ ...nominal, overlap: 0.1 }) === 'move-back',
  'overlap 0.10',
);
check(
  'thin overlap warns without alarming',
  decideGuidance({ ...nominal, overlap: 0.26 }) === 'low-overlap',
  `overlap 0.26 -> "${GUIDANCE_TEXT[decideGuidance({ ...nominal, overlap: 0.26 })]}"`,
);
check('fast sweep says slow down', decideGuidance({ ...nominal, speed: 1.4 }) === 'slow-down', 'speed 1.4 fw/s');
check(
  'soft frames say hold steady',
  decideGuidance({ ...nominal, sharpnessRatio: 0.2 }) === 'hold-steady',
  'sharpness 20% of peak',
);
check(
  'frame budget overrides everything',
  decideGuidance({ ...nominal, budgetReached: true, overlap: 0.05 }) === 'budget',
  'budget reached',
);

// The smoother must stop the pill flickering between states.
{
  const smoother = new GuidanceSmoother('good', GUIDANCE_HOLD_MS);
  let now = 10_000;
  smoother.update('good', now);
  const flapped: Guidance[] = [];
  // Alternate every 66 ms, the sampler's period, for a second.
  for (let i = 0; i < 15; i++) {
    now += 66;
    flapped.push(smoother.update(i % 2 === 0 ? 'hold-steady' : 'good', now));
  }
  const changes = flapped.filter((value, index) => index === 0 || value !== flapped[index - 1]).length;
  check(
    'message does not flicker',
    changes <= 3,
    `${changes} changes over 1s of alternating input, instead of 15`,
  );
}

// A message that persists must still get through.
{
  const smoother = new GuidanceSmoother('good', GUIDANCE_HOLD_MS);
  smoother.update('good', 0);
  smoother.update('slow-down', 100);
  const settled = smoother.update('slow-down', 100 + GUIDANCE_HOLD_MS + 1);
  check('persistent state still shows', settled === 'slow-down', `"${GUIDANCE_TEXT[settled]}"`);
}

// Scan-state messages are never held back.
{
  const smoother = new GuidanceSmoother('good', GUIDANCE_HOLD_MS);
  smoother.update('good', 0);
  check('scan-complete is immediate', smoother.update('complete', 5) === 'complete', 'no dwell applied');
}

console.log(failures === 0 ? '\nAll guidance checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
