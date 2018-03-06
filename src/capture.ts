import assert = require('assert')
import * as puppeteer from 'puppeteer'
import { CaptureTarget, CaptureResult } from './index'

assert(process.send, 'capture.js must be executed in a child process')

let browser: puppeteer.Browser | undefined
let page: puppeteer.Page | undefined

async function capture(
  target: CaptureTarget
): Promise<CaptureResult | undefined> {
  browser = browser || (await puppeteer.launch())
  page = page || (await browser.newPage())

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
}

function generateStyleToHide(selectors: string[]): string {
  return `${selectors.join(',')} { visibility: hidden !important; }`
}

process.on('message', data => {
  capture(data)
    .then(value => {
      process.send!({ failed: false, value })
    })
    .catch(err => {
      process.send!({ failed: true, error: err })
    })
})
