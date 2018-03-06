import * as path from 'path'
import * as fse from 'fs-extra'
import { fork } from 'child_process'
import { Stream, Readable, ReadableOptions } from 'stream'
import tempDir = require('temp-dir')
import { CaptureTarget, CaptureResult, CaptureOptions } from './index'
import { CaptureParams } from './capture'

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
  torndown = false

  constructor(targets: CaptureTarget[], options: CaptureOptions) {
    super({
      objectMode: true
    })
    const concurrency = options.concurrency || 4
    this.processes = range(concurrency).map(() => new ProcessWrapper())
    this.remainingTargets = targets.slice()
  }

  teardown(): void {
    if (!this.torndown) {
      this.torndown = true
      this.processes.forEach(p => p.close())
    }
  }

  startProcess(p: ProcessWrapper): void {
    const target = this.remainingTargets.shift()
    if (!target) {
      if (this.finishedAllProcesses() && !this.torndown) {
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
    ? fork(path.resolve(__dirname, '../lib/capture'))
    : fork(require.resolve('./capture'))

  isRunning = false

  run(target: CaptureTarget): Promise<CaptureResult | undefined> {
    const imagePath =
      path.join(tempDir, `${Date.now()}-${Math.random().toString(16)}`) + '.png'

    const params: CaptureParams = {
      url: target.url,
      target: target.target || 'html',
      hidden: target.hidden || [],
      viewport: target.viewport || {
        width: 800,
        height: 600
      },
      imagePath
    }

    return new Promise((resolve, reject) => {
      this.isRunning = true
      this.cp.send(params)
      this.cp.once('message', err => {
        this.isRunning = false
        if (err) {
          return reject(new Error(err))
        }

        fse
          .readFile(imagePath)
          .then(buf => {
            return fse.unlink(imagePath).then(() => buf)
          })
          .then(buf => {
            const result = {
              image: buf,
              url: params.url,
              target: params.target,
              hidden: params.hidden,
              viewport: params.viewport
            }

            resolve(result)
          })
          .catch(() => {
            resolve()
          })
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
