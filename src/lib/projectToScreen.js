// Convert Normalized Device Coordinates (-1..1, y up) to container pixels (y down).
export function ndcToPixel(ndcX, ndcY, width, height) {
  return {
    x: (ndcX * 0.5 + 0.5) * width,
    y: (1 - (ndcY * 0.5 + 0.5)) * height,
  }
}
