import * as path from 'path'
import * as fs from 'fs'
import * as util from 'util'
import * as tempDir from 'temp-dir'
import * as puppeteer from 'puppeteer'

const readFile = util.promisify(fs.readFile)
const unlink = util.promisify(fs.unlink)

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
      page.setViewport(target.viewport)
    }
    if (target.hidden) {
      await page.addStyleTag({
        content: generateStyleToHide(target.hidden)
      })
    }
    const els = await getCaptureElement(page, target.target)

    return Promise.all(
      els.map(async el => {
        const tempPath = path.join(
          tempDir,
          `block-capture-image-${Date.now().toString(16)}.png`
        )
        await el.screenshot({ path: tempPath })
        const image = await readFile(tempPath)
        await unlink(tempPath)

        return {
          image,
          url: target.url,
          target: target.target || 'html',
          hidden: target.hidden || [],
          viewport: page.viewport()
        }
      })
    )
  })
    .then(flatten)
    .then(
      res => {
        browser.close()
        return res
      },
      err => {
        browser.close()
        throw err
      }
    )
}

function getCaptureElement(
  page: puppeteer.Page,
  selector: string | undefined
): Promise<puppeteer.ElementHandle[]> {
  return page.$$(selector || 'html')
}

function generateStyleToHide(selectors: string[]): string {
  return `${selectors.join(',')} { visibility: hidden !important; }`
}

function flatten<T>(list: T[][]): T[] {
  return list.reduce<T[]>((acc, child) => {
    return acc.concat(child)
  }, [])
}

function seqAsync<T, R>(list: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  return list.reduce<Promise<R[]>>(async (acc, item) => {
    const res = await acc
    const next = await fn(item)
    return res.concat(next)
  }, Promise.resolve([]))
}
