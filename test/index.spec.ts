import * as path from 'path'
import { captureAll } from '../src/index'

describe('Snapshot test', async () => {
  const fixtureUrl = 'file://' + path.resolve(__dirname, 'fixture.html')

  it('should capture web page', async () => {
    const res = await captureAll([{ url: fixtureUrl }])
    expect(res[0].url).toBe(fixtureUrl)
    expect(res[0].target).toBe('html')
    expect(res[0].image).toMatchImageSnapshot()
  })

  it('should narrow capture element by selector', async () => {
    const res = await captureAll([
      {
        url: fixtureUrl,
        target: '.paragraph'
      }
    ])
    expect(res.length).toBe(2)
    expect(res[0].target).toBe('.paragraph')
    expect(res[0].image).toMatchImageSnapshot()
    expect(res[1].target).toBe('.paragraph')
    expect(res[1].image).toMatchImageSnapshot()
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
})
