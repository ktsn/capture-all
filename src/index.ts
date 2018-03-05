import * as puppeteer from 'puppeteer'

export interface Viewport {
  width: number
  height: number
}

export interface CaptureTarget {
  url: string
  target?: string
  hidden?: string[]
  viewport?: Viewport
}

export interface CaptureResult {
  image: Buffer
  url: string
  target: string
  hidden: string[]
  viewport: Viewport
}

export default async function captureAll(
  targets: CaptureTarget[]
): Promise<CaptureResult[]> {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  return seqAsync(targets, async target => {
    await page.goto(target.url)
    if (target.viewport) {
      await page.setViewport(target.viewport)
    }
    if (target.hidden) {
      await page.addStyleTag({
        content: generateStyleToHide(target.hidden)
      })
    }
    const el = await page.$(target.target || 'html')
    if (!el) {
      return
    }

    const image = await el.screenshot()

    return {
      image,
      url: target.url,
      target: target.target || 'html',
      hidden: target.hidden || [],
      viewport: page.viewport()
    }
  }).then(
    res => {
      browser.close()
      return res.filter(<T>(x: T | undefined): x is T => x !== undefined)
    },
    err => {
      browser.close()
      throw err
    }
  )
}

function generateStyleToHide(selectors: string[]): string {
  return `${selectors.join(',')} { visibility: hidden !important; }`
}

function seqAsync<T, R>(list: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  return list.reduce<Promise<R[]>>(async (acc, item) => {
    const res = await acc
    const next = await fn(item)
    return res.concat(next)
  }, Promise.resolve([]))
}
