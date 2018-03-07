import assert = require('assert')
import * as puppeteer from 'puppeteer'
import { Viewport } from './index'

export interface CaptureParams {
  url: string
  target: string
  hidden: string[]
  viewport: Viewport
  imagePath: string
  options?: puppeteer.LaunchOptions
}

assert(process.send, 'capture.js must be executed in a child process')

async function capture(target: CaptureParams): Promise<void> {
  const browser = await puppeteer.launch(target.options)
  const page = await browser.newPage()

  await page.goto(target.url)
  await page.setViewport(target.viewport)
  if (target.hidden.length > 0) {
    await page.addStyleTag({
      content: generateStyleToHide(target.hidden)
    })
  }

  const el = await page.$(target.target)
  if (el) {
    await el.screenshot({ path: target.imagePath })
  }

  await browser.close()
}

function generateStyleToHide(selectors: string[]): string {
  return `${selectors.join(',')} { visibility: hidden !important; }`
}

process.on('message', data => {
  capture(data)
    .then(() => {
      if (process.connected) {
        process.send!(null)
      }
    })
    .catch(err => {
      if (process.connected) {
        process.send!(err.message)
      }
    })
})
