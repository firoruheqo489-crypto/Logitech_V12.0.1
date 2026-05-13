import type { ImageEntry, StitchLayout } from './types';

/**
 * Empty layout used when no images are provided. Kept as a shared
 * constant so that both stitch functions return an identical,
 * structurally-stable value for the empty-input case.
 */
const EMPTY_LAYOUT: StitchLayout = {
  canvasWidth: 0,
  canvasHeight: 0,
  placements: [],
};

/**
 * Compute the vertical stitch layout for an ordered list of images.
 *
 * Layout rules:
 * - The widest image's natural width defines the `baseWidth` — this
 *   becomes the canvas width.
 * - Every image is scaled uniformly (preserving aspect ratio) so that
 *   its scaled width equals `baseWidth`.
 * - Images are stacked top-to-bottom in input order; each image's `y`
 *   is the cumulative sum of scaled heights of all preceding images.
 * - The canvas height equals the sum of all scaled image heights.
 *
 * For an empty input, returns a zero-sized layout with no placements.
 *
 * This function is pure: it performs no I/O, reads no globals, and
 * does not mutate its inputs.
 */
export function computeVerticalStitch(images: ImageEntry[]): StitchLayout {
  if (images.length === 0) {
    return { ...EMPTY_LAYOUT, placements: [] };
  }

  // Find the widest original width — this becomes the target width.
  const maxWidth = images.reduce(
    (max, image) => (image.width > max ? image.width : max),
    0,
  );

  const placements: StitchLayout['placements'] = [];
  let cumulativeY = 0;

  for (const image of images) {
    // INVARIANT: scaleX === scaleY — uniform scale preserves aspect ratio.
    // NEVER set width/height directly on the Fabric object; only use scale.
    const scaleFactor = maxWidth / image.width;

    placements.push({
      imageId: image.id,
      x: 0,
      y: cumulativeY,
      scaleX: scaleFactor,
      scaleY: scaleFactor,
    });

    // Accumulate using the scaled visual height (image.height * scaleFactor)
    cumulativeY += image.height * scaleFactor;
  }

  return {
    canvasWidth: maxWidth,
    canvasHeight: cumulativeY,
    placements,
  };
}

/**
 * Compute the horizontal stitch layout for an ordered list of images.
 *
 * Layout rules:
 * - The tallest image's natural height defines the `baseHeight` —
 *   this becomes the canvas height.
 * - Every image is scaled uniformly (preserving aspect ratio) so that
 *   its scaled height equals `baseHeight`.
 * - Images are arranged left-to-right in input order; each image's
 *   `x` is the cumulative sum of scaled widths of all preceding
 *   images.
 * - The canvas width equals the sum of all scaled image widths.
 *
 * For an empty input, returns a zero-sized layout with no placements.
 *
 * This function is pure: it performs no I/O, reads no globals, and
 * does not mutate its inputs.
 */
export function computeHorizontalStitch(images: ImageEntry[]): StitchLayout {
  if (images.length === 0) {
    return { ...EMPTY_LAYOUT, placements: [] };
  }

  // Find the tallest original height — this becomes the target height.
  const maxHeight = images.reduce(
    (max, image) => (image.height > max ? image.height : max),
    0,
  );

  const placements: StitchLayout['placements'] = [];
  let cumulativeX = 0;

  for (const image of images) {
    // INVARIANT: scaleX === scaleY — uniform scale preserves aspect ratio.
    // NEVER set width/height directly on the Fabric object; only use scale.
    const scaleFactor = maxHeight / image.height;

    placements.push({
      imageId: image.id,
      x: cumulativeX,
      y: 0,
      scaleX: scaleFactor,
      scaleY: scaleFactor,
    });

    // Accumulate using the scaled visual width (image.width * scaleFactor)
    cumulativeX += image.width * scaleFactor;
  }

  return {
    canvasWidth: cumulativeX,
    canvasHeight: maxHeight,
    placements,
  };
}
