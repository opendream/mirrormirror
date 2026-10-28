/** Even output dimensions, bounded by the chosen preset, with no upscaling. */
export function outputSize(width, height, maxHeight = 1080) {
  const scale = Math.min(1, (maxHeight * 16 / 9) / width, maxHeight / height);
  return { width: Math.max(2, Math.floor(width * scale / 2) * 2), height: Math.max(2, Math.floor(height * scale / 2) * 2) };
}

export function fitInside(sourceWidth, sourceHeight, width, height) {
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const w = sourceWidth * scale, h = sourceHeight * scale;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

export function faceRectangle(width, height, ratio, percent, position) {
  const margin = Math.max(8, Math.round(width * .012));
  const w = Math.max(0, Math.min(width * percent / 100, (height - margin * 2) / ratio));
  const h = w * ratio;
  return {
    x: position.endsWith('left') ? margin : width - w - margin,
    y: position.startsWith('top') ? margin : height - h - margin,
    width: w,
    height: h,
  };
}
