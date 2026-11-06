import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const decode = promisify(execFile);
const results = new Map();
const local = (path) => new URL(path, import.meta.url);

async function measure(take) {
  const { stdout: pixels } = await decode('ffmpeg', [
    '-v', 'error', '-i', local(`media/${take}.mp4`).pathname,
    '-t', '2', '-vf', 'fps=10,scale=320:180', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-',
  ], { encoding: 'buffer', maxBuffer: 5_000_000 });
  const frameBytes = 320 * 180 * 3;
  const samples = [];
  for (let frame = 0; (frame + 1) * frameBytes <= pixels.length; frame++) {
    const occupied = [];
    // Window and color limits are calibrated to these locked-camera shots.
    for (let x = 122; x < 202; x++) {
      let bluePixels = 0;
      for (let y = 32; y < 76; y++) {
        const i = frame * frameBytes + (y * 320 + x) * 3;
        const red = pixels[i], green = pixels[i + 1], blue = pixels[i + 2];
        if (blue > 115 && green > 65 && green > red * 1.3 + 10 && blue > red * 1.45 + 20) {
          bluePixels++;
        }
      }
      if (bluePixels >= 3) occupied.push(x);
    }
    samples.push({
      timeSeconds: frame / 10,
      blueColumns: occupied.length,
      spanPixels: occupied.length ? occupied.at(-1) - occupied[0] + 1 : 0,
    });
  }
  const limit = 44;
  const overflow = (sample) => sample.spanPixels > limit && sample.blueColumns > limit;
  const evidence = samples.reduce((peak, sample) => sample.blueColumns > peak.blueColumns ? sample : peak,
    { timeSeconds: 0, blueColumns: 0, spanPixels: 0 });
  const status = samples.some((sample, i) => i > 0 && overflow(sample) && overflow(samples[i - 1]))
    ? 'overflow'
    : samples.filter((sample) => sample.blueColumns >= 20).length >= 3 ? 'within_limit' : 'inconclusive';
  return { status, ...evidence, limitPixels: limit, sampledFrames: samples.length };
}

function getMeasurement(take) {
  if (!results.has(take)) {
    results.set(take, measure(take).catch((error) => {
      results.delete(take);
      throw error;
    }));
  }
  return results.get(take);
}

// Editorial findings for the bundled takes. Keep them separate from pixel measurements.
const visualFindings = {
  generated: {
    check: 'upper_block_sequence',
    source: 'human_review',
    status: 'failed',
    timeSeconds: 0.9,
    finding: 'The opening already shows three blue blocks. The upper row later contains six.',
  },
  corrected: {
    check: 'upper_slot_alignment',
    source: 'human_review',
    status: 'failed',
    timeSeconds: 1.1,
    finding: 'The three blue blocks sit across the divider between two rows instead of seating inside three slots.',
  },
};

export async function review(take) {
  const check = await getMeasurement(take);
  return {
    take,
    decision: 'reject_shot',
    paidRenderGuidance: 'defer_to_reviewer',
    reason: visualFindings[take].finding,
    evidence: { check: 'upper_grid_blue_footprint', source: 'automated_measurement', ...check },
    visualFinding: visualFindings[take],
    nextSteps: [
      take === 'generated' ? 'Rebuild the blue-block sequence on the existing board plate' : 'Reposition the three blocks inside their slots on the existing shot',
      'Keep the separately approved helicopter and bomb sequence',
    ],
    humanReview: ['Verify two waiting blocks, then three fully seated in their slots', 'Verify that one crosses and lands in its intended slot'],
    scope: 'The automated check measures blue width. The failure verdict also uses a human finding for each bundled take.',
  };
}
