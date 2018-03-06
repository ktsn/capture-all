import * as path from 'path'
import { fork } from 'child_process'
import { Stream, Readable, ReadableOptions } from 'stream'
import { CaptureTarget, CaptureResult, CaptureOptions } from './index'

export interface ReadableStream<T> extends NodeJS.ReadableStream, Stream {
  push(data: T): boolean

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

  once(event: string, listener: (...args: any[]) => void): this
  once(event: 'close', listener: () => void): this
  once(event: 'data', listener: (chunk: T) => void): this
  once(event: 'end', listener: () => void): this
  once(event: 'readable', listener: () => void): this
  once(event: 'error', listener: (err: Error) => void): this

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

export class ReadableStreamImpl extends Readable
  implements ReadableStream<CaptureResult> {
  remainingTargets: CaptureTarget[]
  processes: ProcessWrapper[]

  constructor(targets: CaptureTarget[], options: CaptureOptions) {
    super({
      objectMode: true
    })
    const concurrency = options.concurrency || 4
    this.processes = range(concurrency).map(() => new ProcessWrapper())
    this.remainingTargets = targets.slice()
  }

  teardown(): void {
    this.processes.forEach(p => p.close())
  }

  startProcess(p: ProcessWrapper): void {
    const target = this.remainingTargets.shift()
    if (!target) {
      if (this.finishedAllProcesses()) {
        this.push(null)
        this.teardown()
      }
      return
    }

    p
      .run(target)
      .then(result => {
        if (!result) {
          return this.startProcess(p)
        }

        const shouldContinue = this.push(result)
        if (shouldContinue) {
          return this.startProcess(p)
        }
      })
      .catch(err => {
        debugger
        process.nextTick(() => this.emit('error', err))
        this.teardown()
      })
  }

  finishedAllProcesses(): boolean {
    return this.processes.every(p => !p.isRunning)
  }

  _read(size: number): void {
    this.processes.filter(p => !p.isRunning).forEach(p => {
      this.startProcess(p)
    })
  }

  _destroy(err: Error, callback: Function): void {
    super._destroy(err, callback)
    this.teardown()
  }
}

export class ProcessWrapper {
  private cp = process.env.NODE_ENV === 'test'
    ? fork(path.resolve(__dirname, '../lib/capture'), [], {
        stdio: 'inherit' as any
      })
    : fork(require.resolve('./capture'))
  isRunning = false

  run(target: CaptureTarget): Promise<CaptureResult | undefined> {
    debugger
    return new Promise((resolve, reject) => {
      this.isRunning = true
      this.cp.send(target)
      this.cp.once('message', result => {
        this.isRunning = false
        if (result.failed) {
          return reject(result.error)
        }
        resolve(result.value)
      })
      this.cp.once('error', err => {
        reject(err)
      })
    })
  }

  close(): void {
    this.cp.kill()
  }
}

function range(len: number): number[] {
  return Array.apply(null, Array(len)).map((_: any, i: number) => i)
}
