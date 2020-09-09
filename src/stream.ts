import assert = require('assert')
import * as puppeteer from 'puppeteer'
import { Stream, Readable, ReadableOptions } from 'stream'
import { CaptureTarget, CaptureResult, CaptureOptions } from './index'

export interface ReadableStream<T> extends Readable {
  push(data: T): boolean
  unshift(chunk: T): void

  addListener(event: 'close', listener: () => void): this
  addListener(event: 'data', listener: (chunk: T) => void): this
  addListener(event: 'end', listener: () => void): this
  addListener(event: 'readable', listener: () => void): this
  addListener(event: 'error', listener: (err: Error) => void): this
  addListener(event: string, listener: (...args: any[]) => void): this

  emit(event: 'close'): boolean
  emit(event: 'data', chunk: T): boolean
  emit(event: 'end'): boolean
  emit(event: 'readable'): boolean
  emit(event: 'error', err: Error): boolean
  emit(event: string | symbol, ...args: any[]): boolean

  on(event: 'close', listener: () => void): this
  on(event: 'data', listener: (chunk: T) => void): this
  on(event: 'end', listener: () => void): this
  on(event: 'readable', listener: () => void): this
  on(event: 'error', listener: (err: Error) => void): this
  on(event: string, listener: (...args: any[]) => void): this

  once(event: 'close', listener: () => void): this
  once(event: 'data', listener: (chunk: T) => void): this
  once(event: 'end', listener: () => void): this
  once(event: 'readable', listener: () => void): this
  once(event: 'error', listener: (err: Error) => void): this
  once(event: string, listener: (...args: any[]) => void): this

  prependListener(event: 'close', listener: () => void): this
  prependListener(event: 'data', listener: (chunk: T) => void): this
  prependListener(event: 'end', listener: () => void): this
  prependListener(event: 'readable', listener: () => void): this
  prependListener(event: 'error', listener: (err: Error) => void): this
  prependListener(event: string, listener: (...args: any[]) => void): this

  prependOnceListener(event: 'close', listener: () => void): this
  prependOnceListener(event: 'data', listener: (chunk: T) => void): this
  prependOnceListener(event: 'end', listener: () => void): this
  prependOnceListener(event: 'readable', listener: () => void): this
  prependOnceListener(event: 'error', listener: (err: Error) => void): this
  prependOnceListener(event: string, listener: (...args: any[]) => void): this

  removeListener(event: 'close', listener: () => void): this
  removeListener(event: 'data', listener: (chunk: T) => void): this
  removeListener(event: 'end', listener: () => void): this
  removeListener(event: 'readable', listener: () => void): this
  removeListener(event: 'error', listener: (err: Error) => void): this
  removeListener(event: string, listener: (...args: any[]) => void): this
}

export class ReadableStreamImpl
  extends Readable
  implements ReadableStream<CaptureResult> {
  remainingTargets: CaptureTarget[]
  processes: PuppeteerWrapper[]
  torndown = false

  constructor(targets: CaptureTarget[], options: CaptureOptions) {
    super({
      objectMode: true,
    })
    assert(targets.length > 0, 'capture target must have at least one')

    const concurrency = Math.min(targets.length, options.concurrency || 4)
    this.processes = range(concurrency).map(
      () => new PuppeteerWrapper(options.puppeteer)
    )
    this.remainingTargets = targets.slice()
  }

  teardown(): void {
    if (!this.torndown) {
      this.torndown = true
      this.processes.forEach((p) => p.close())
    }
  }

  startProcess(p: PuppeteerWrapper): void {
    if (p.isRunning || p.isClosed) {
      return
    }

    const target = this.remainingTargets.shift()
    if (!target) {
      if (this.finishedAllProcesses() && !this.torndown) {
        this.push(null)
        this.teardown()
      }
      return
    }

    p.run(target).then(
      (result) => {
        const shouldContinue = result.reduce((_, item) => {
          return this.push(item)
        }, true)
        if (shouldContinue) {
          return this.startProcess(p)
        }
      },
      (err) => {
        process.nextTick(() => this.emit('error', err))
        this.teardown()
      }
    )
  }

  finishedAllProcesses(): boolean {
    return this.processes.every((p) => !p.isRunning)
  }

  _read(size: number): void {
    this.processes.forEach((p) => {
      this.startProcess(p)
    })
  }

  _destroy(err: Error, callback: (error?: Error | null) => void): void {
    super._destroy(err, callback)
    this.teardown()
  }
}

export class PuppeteerWrapper {
  private browser: puppeteer.Browser | undefined

  isRunning = false
  isClosed = false

  signals = ['exit', 'SIGTERM', 'SIGINT', 'SIGHUP']
  signalListener = () => {
    this.close(true)
  }

  constructor(private options: puppeteer.LaunchOptions | undefined) {
    this.signals.forEach((event) => {
      process.on(event as any, this.signalListener)
    })
  }

  async run(target: CaptureTarget): Promise<CaptureResult[]> {
    assert(!this.isClosed, 'already closed')
    assert(!this.isRunning, 'must not capture in parallel')
    this.isRunning = true

    if (!this.browser) {
      this.browser = await puppeteer.launch(this.options)
    }

    const page = await this.browser.newPage()

    let captureIndex = 0
    const captureResults: CaptureResult[] = []
    async function baseCapture(target: string = t.target): Promise<void> {
      const el = await page.$(target)
      if (!el) {
        return
      }

      captureResults.push({
        index: captureIndex++,
        image: await sleep(t.delay).then(() =>
          el.screenshot({ encoding: 'binary' })
        ),
        url: t.url,
        target,
        hidden: t.hidden,
        remove: t.remove,
        disableCssAnimation: t.disableCssAnimation,
        delay: t.delay,
        viewport: t.viewport,
      })
    }

    const targetCapture = target.capture

    const t = {
      url: target.url,
      target: target.target || 'html',
      hidden: target.hidden || [],
      remove: target.remove || [],
      disableCssAnimation: target.disableCssAnimation ?? true,
      delay: target.delay ?? 0,
      viewport: target.viewport || {
        width: 800,
        height: 600,
      },
      capture: targetCapture
        ? () => targetCapture(page, baseCapture)
        : baseCapture,
    }

    try {
      await page.setViewport(t.viewport)
      await page.goto(t.url, { timeout: 0 })

      if (t.hidden.length > 0) {
        await page.addStyleTag({
          content: generateStyleToHide(t.hidden),
        })
      }

      if (t.remove.length > 0) {
        await page.addStyleTag({
          content: generateStyleToRemove(t.remove),
        })
      }

      if (t.disableCssAnimation) {
        await page.addStyleTag({
          content: styleToDisableCssAnimation,
        })
      }

      await t.capture()
      return captureResults
    } catch (e) {
      if (!this.isClosed) {
        throw e
      }
      return []
    } finally {
      this.isRunning = false
    }
  }

  close(fromSignal: boolean = false): void {
    assert(!this.isClosed, 'already closed')

    this.signals.forEach((event) => {
      process.removeListener(event, this.signalListener)
    })

    if (this.browser) {
      this.isRunning = false
      this.isClosed = true

      // If this is called by signal,
      // the browser process will be exited automatically
      if (!fromSignal) {
        this.browser.close()
      }

      this.browser = undefined
    }
  }
}

const styleToDisableCssAnimation = `
*,
*::before,
*::after {
  transition: none !important;
  animation: none !important;
}

input {
  caret-color: transparent !important;
}
`

function generateStyleToHide(selectors: string[]): string {
  return `${selectors.join(',')} { visibility: hidden !important; }`
}

function generateStyleToRemove(selectors: string[]): string {
  return `${selectors.join(',')} { display: none !important; }`
}

function range(len: number): number[] {
  return Array.apply(null, Array(len)).map((_: any, i: number) => i)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
