import * as puppeteer from 'puppeteer'
import { ReadableStream, ReadableStreamImpl } from './stream'

export { ReadableStream }

export interface Viewport {
  width: number
  height: number
}

export interface CaptureTarget {
  url: string
  target?: string
  hidden?: string[]
  remove?: string[]
  disableCssAnimation?: boolean
  delay?: number
  viewport?: Viewport
  capture?: (
    page: puppeteer.Page,
    capture: (target?: string) => Promise<void>
  ) => Promise<void>
}

export interface CaptureResult {
  index: number
  image: Buffer
  url: string
  target: string
  hidden: string[]
  remove: string[]
  disableCssAnimation: boolean
  delay: number
  viewport: Viewport
}

export interface CaptureOptions {
  concurrency?: number
  puppeteer?: puppeteer.LaunchOptions
}

export function captureAll(
  targets: CaptureTarget[],
  options: CaptureOptions = {}
): Promise<CaptureResult[]> {
  const stream = createCaptureStream(targets, options)
  const result: CaptureResult[] = []

  stream.on('data', (data) => {
    result.push(data)
  })

  return new Promise((resolve, reject) => {
    stream.on('end', () => resolve(result))
    stream.on('error', reject)
  })
}

export function createCaptureStream(
  targets: CaptureTarget[],
  options: CaptureOptions = {}
): ReadableStream<CaptureResult> {
  return new ReadableStreamImpl(targets, options)
}
