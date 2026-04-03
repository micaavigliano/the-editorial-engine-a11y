import {
  prepareWithSegments,
  layoutNextLine,
  layoutWithLines,
  walkLineRanges,
} from '@chenglou/pretext'
import type { PreparedTextWithSegments, LayoutCursor } from '@chenglou/pretext'
import type { Interval, CircleObs, TextLine } from './types'

const MIN_SLOT_WIDTH = 50

export const carveTextLineSlots = (base: Interval, blocked: Interval[]): Interval[] =>
  blocked
    .reduce<Interval[]>((slots, iv) =>
      slots.flatMap((s) => {
        if (iv.right <= s.left || iv.left >= s.right) return [s]
        const result: Interval[] = []
        if (iv.left > s.left) result.push({ left: s.left, right: iv.left })
        if (iv.right < s.right) result.push({ left: iv.right, right: s.right })
        return result
      }),
    [base])
    .filter((s) => s.right - s.left >= MIN_SLOT_WIDTH)

export const circleIntervalForBand = (
  cx: number, cy: number, r: number,
  bandTop: number, bandBottom: number,
  hPad: number, vPad: number,
): Interval | null => {
  const top = bandTop - vPad
  const bottom = bandBottom + vPad
  if (top >= cy + r || bottom <= cy - r) return null
  const minDy = cy >= top && cy <= bottom ? 0 : cy < top ? top - cy : cy - bottom
  if (minDy >= r) return null
  const maxDx = Math.sqrt(r * r - minDy * minDy)
  return { left: cx - maxDx - hPad, right: cx + maxDx + hPad }
}

export const getBlockedIntervals = (
  bandTop: number, bandBottom: number,
  circleObs: CircleObs[],
  rectObstacles: { x: number; y: number; w: number; h: number }[],
): Interval[] => [
  ...circleObs
    .map((c) => circleIntervalForBand(c.cx, c.cy, c.r, bandTop, bandBottom, c.hPad, c.vPad))
    .filter((iv): iv is Interval => iv !== null),
  ...rectObstacles
    .filter((r) => !(bandBottom <= r.y || bandTop >= r.y + r.h))
    .map((r) => ({ left: r.x, right: r.x + r.w })),
]

export const layoutColumnAt = (
  prepared: PreparedTextWithSegments,
  startCursor: LayoutCursor,
  regionX: number, regionY: number, regionW: number, regionH: number,
  lineHeight: number,
  circleObs: CircleObs[],
  rectObstacles: { x: number; y: number; w: number; h: number }[],
) => {
  let cursor = startCursor
  let lineTop = regionY
  const lines: TextLine[] = []
  let textExhausted = false

  while (lineTop + lineHeight <= regionY + regionH && !textExhausted) {
    const blocked = getBlockedIntervals(lineTop, lineTop + lineHeight, circleObs, rectObstacles)
    const slots = carveTextLineSlots({ left: regionX, right: regionX + regionW }, blocked)
      .toSorted((a, b) => a.left - b.left)

    if (slots.length === 0) { lineTop += lineHeight; continue }

    for (const slot of slots) {
      const line = layoutNextLine(prepared, cursor, slot.right - slot.left)
      if (!line) { textExhausted = true; break }
      lines.push({ x: Math.round(slot.left), y: Math.round(lineTop), text: line.text, width: line.width })
      cursor = line.end
    }
    lineTop += lineHeight
  }
  return { lines, cursor, textExhausted }
}

export const fitHeadline = (text: string, fontFamily: string, maxWidth: number, maxHeight: number) => {
  let lo = 24, hi = 120, best = lo
  let bestLines: TextLine[] = []

  while (lo <= hi) {
    const size = Math.floor((lo + hi) / 2)
    const font = `700 ${size}px ${fontFamily}`
    const lh = Math.round(size * 0.93)
    const prepared = prepareWithSegments(text, font)
    let breaksWord = false
    let lineCount = 0
    walkLineRanges(prepared, maxWidth, (line) => {
      lineCount++
      if (line.end.graphemeIndex !== 0) breaksWord = true
    })

    if (!breaksWord && lineCount * lh <= maxHeight) {
      best = size
      const result = layoutWithLines(prepared, maxWidth, lh)
      bestLines = result.lines.map((l, i) => ({ x: 0, y: i * lh, text: l.text, width: l.width }))
      lo = size + 1
    } else {
      hi = size - 1
    }
  }
  return { fontSize: best, lines: bestLines }
}

export type LayoutConfig = {
  preparedParagraphs: PreparedTextWithSegments[]
  bodyTop: number
  rowHeight: number
  colCount: number
  colWidth: number
  contentLeft: number
  colGap: number
  lineHeight: number
  paragraphGap: number
  circleObs: CircleObs[]
  dropCapRect: { x: number; y: number; w: number; h: number }
}

// Fill a single column top-to-bottom, flowing across paragraph boundaries.
// Returns updated paraIndex/cursor so the next column continues seamlessly.
const fillColumn = (
  config: LayoutConfig,
  colX: number,
  rowTop: number,
  rowBottom: number,
  paraIndex: number,
  cursor: LayoutCursor,
  isFirstColumn: boolean,
): { lines: TextLine[]; paraIndex: number; cursor: LayoutCursor; allDone: boolean } => {
  const { preparedParagraphs, bodyTop, lineHeight, paragraphGap, circleObs, dropCapRect } = config
  const lines: TextLine[] = []
  let lineTop = rowTop

  while (lineTop + lineHeight <= rowBottom && paraIndex < preparedParagraphs.length) {
    const prepared = preparedParagraphs[paraIndex]
    const rects = (paraIndex === 0 && isFirstColumn && lineTop < bodyTop + dropCapRect.h)
      ? [dropCapRect] : []
    const blocked = getBlockedIntervals(lineTop, lineTop + lineHeight, circleObs, rects)
    const slots = carveTextLineSlots({ left: colX, right: colX + config.colWidth }, blocked)
      .toSorted((a, b) => a.left - b.left)

    if (slots.length === 0) {
      lineTop += lineHeight
      continue
    }

    let paragraphDone = false
    for (const slot of slots) {
      const line = layoutNextLine(prepared, cursor, slot.right - slot.left)
      if (!line) { paragraphDone = true; break }
      lines.push({ x: Math.round(slot.left), y: Math.round(lineTop), text: line.text, width: line.width })
      cursor = line.end
    }

    if (paragraphDone) {
      paraIndex++
      cursor = { segmentIndex: 0, graphemeIndex: 0 }
      lineTop += lineHeight + paragraphGap
    } else {
      lineTop += lineHeight
    }
  }

  return { lines, paraIndex, cursor, allDone: paraIndex >= preparedParagraphs.length }
}

export const layoutAllText = (config: LayoutConfig): TextLine[] => {
  const {
    preparedParagraphs, bodyTop, rowHeight, colCount, contentLeft,
    colGap, colWidth,
  } = config

  const allLines: TextLine[] = []
  let paraIndex = 0
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 1 } // skip drop cap
  let rowTop = bodyTop

  while (paraIndex < preparedParagraphs.length) {
    const rowBottom = rowTop + rowHeight

    for (let col = 0; col < colCount; col++) {
      if (paraIndex >= preparedParagraphs.length) break
      const colX = contentLeft + col * (colWidth + colGap)
      const isFirstColumn = rowTop === bodyTop && col === 0

      const result = fillColumn(config, colX, rowTop, rowBottom, paraIndex, cursor, isFirstColumn)
      allLines.push(...result.lines)
      paraIndex = result.paraIndex
      cursor = result.cursor
      if (result.allDone) break
    }

    rowTop = rowBottom // seamless — next row starts where this one ends
  }

  return allLines
}

export const measureDropCap = (char: string, font: string) => {
  const prepared = prepareWithSegments(char, font)
  let width = 0
  walkLineRanges(prepared, 9999, (line) => { width = line.width })
  return Math.ceil(width) + 10
}
