import * as path from 'path'
import * as fs from 'fs'
// @ts-ignore
import tempDir = require('temp-dir')
import { captureAll, createCaptureStream } from '../src/index'

describe('Snapshot test', async () => {
  const fixtureUrl = 'file://' + path.resolve(__dirname, 'fixture.html')

  it('should capture web page', async () => {
    const res = await captureAll([{ url: fixtureUrl }], {
      concurrency: 1
    })
    expect(res[0].url).toBe(fixtureUrl)
    expect(res[0].target).toBe('html')
    expect(res[0].hidden).toEqual([])
    expect(res[0].viewport).toEqual({
      width: 800,
      height: 600
    })
    expect(res[0].image).toMatchImageSnapshot()
  })

  it('should narrow capture element by selector', async () => {
    const res = await captureAll([
      {
        url: fixtureUrl,
        target: '.paragraph'
      }
    ])
    expect(res.length).toBe(1)
    expect(res[0].target).toBe('.paragraph')
    expect(res[0].image).toMatchImageSnapshot()
  })

  it('should hide specified selectors', async () => {
    const res = await captureAll([
      {
        url: fixtureUrl,
        hidden: ['#title', '#sub-title']
      }
    ])
    expect(res[0].image).toMatchImageSnapshot()
    expect(res[0].hidden).toEqual(['#title', '#sub-title'])
  })

  it('should resolve viewport size', async () => {
    const res = await captureAll([
      {
        url: fixtureUrl,
        viewport: {
          width: 320,
          height: 480
        }
      }
    ])
    expect(res[0].image).toMatchImageSnapshot()
    expect(res[0].viewport).toEqual({
      width: 320,
      height: 480
    })
  })

  it('should throw if capturing process throws', async () => {
    const mock = jest.fn(err => {
      expect(err.message).toMatch('ERR_FILE_NOT_FOUND')
    })

    await captureAll([
      {
        url: generateNotFoundUrl()
      }
    ]).catch(mock)

    expect(mock).toHaveBeenCalled()
  })

  it('should create capture stream', done => {
    const dataMock = jest.fn(res => {
      expect(res.url).toBe(fixtureUrl)
      expect(res.target).toBe('html')
      expect(res.hidden).toEqual([])
      expect(res.viewport).toEqual({
        width: 800,
        height: 600
      })
      expect(res.image).toMatchImageSnapshot()
    })
    const errorMock = jest.fn()

    const stream = createCaptureStream(
      [
        {
          url: fixtureUrl
        }
      ],
      {
        concurrency: 1
      }
    )

    stream.on('data', dataMock)
    stream.on('error', errorMock)
    stream.on('end', () => {
      expect(dataMock).toHaveBeenCalledTimes(1)
      expect(errorMock).not.toHaveBeenCalled()
      done()
    })
  })

  it('should notify error from stream if capturing process throws', done => {
    const dataMock = jest.fn()
    const endMock = jest.fn()

    const stream = createCaptureStream([
      {
        url: generateNotFoundUrl()
      }
    ])

    stream.on('data', dataMock)
    stream.on('end', endMock)
    stream.on('error', err => {
      expect(err.message).toMatch('ERR_FILE_NOT_FOUND')
      expect(dataMock).not.toHaveBeenCalledTimes(1)
      expect(endMock).not.toHaveBeenCalled()
      done()
    })
  })
})

function generateNotFoundUrl() {
  const base = path.join(tempDir, 'not_found_file')
  let file = base
  let i = 0
  while (fs.existsSync(file)) {
    file = base + '_' + i
    i++
  }
  return 'file://' + file
}
