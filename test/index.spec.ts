import * as path from 'path'
import captureAll from '../src/index'

describe('Snapshot test', async () => {
  const fixtureUrl = 'file://' + path.resolve(__dirname, 'fixture.html')

  it('should capture web page', async () => {
    const res = await captureAll([{ url: fixtureUrl }])
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
})
