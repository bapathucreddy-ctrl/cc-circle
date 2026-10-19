/** Signed scroll delta needed to keep a field inside the usable viewport. */
export function keyboardScrollAdjustment(inputTop: number, inputHeight: number, viewportTop: number, viewportBottom: number, gap = 20) {
  const top = viewportTop + gap;
  const bottom = viewportBottom - gap;
  if (bottom <= top) return 0;
  // A tall multiline field cannot fit entirely: keep its start visible.
  if (inputHeight > bottom - top) return inputTop - top;
  if (inputTop < top) return inputTop - top;
  if (inputTop + inputHeight > bottom) return inputTop + inputHeight - bottom;
  return 0;
}
