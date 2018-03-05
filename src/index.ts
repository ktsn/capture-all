import * as path from 'path'
import * as fs from 'fs'
import * as util from 'util'
import * as tempDir from 'temp-dir'
import * as puppeteer from 'puppeteer'

const readFile = util.promisify(fs.readFile)

interface CaptureTarget {
  url: string
}

interface CaptureResult {
  image: Buffer
}

export async function captureAll(
  targets: CaptureTarget[]
): Promise<CaptureResult[]> {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  return seqAsync(targets, async target => {
    const tempPath = path.join(
      tempDir,
      `block-capture-image-${Date.now().toString(16)}.png`
    )
    await page.goto(target.url)
    await page.screenshot({ path: tempPath })
    return {
      image: await readFile(tempPath)
    }
  })
    .then(res => {
      browser.close()
      return res
    })
    .catch(err => {
      browser.close()
      throw err
    })
}

function seqAsync<T, R>(list: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  return list.reduce<Promise<R[]>>(async (acc, item) => {
    const res = await acc
    const next = await fn(item)
    return res.concat(next)
  }, Promise.resolve([]))
}
