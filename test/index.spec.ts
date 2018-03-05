import * as path from 'path'
import { captureAll } from '../src/index'

describe('Snapshot test', async () => {
  const fixtureUrl = 'file://' + path.resolve(__dirname, 'fixture.html')

  it('should capture web page', async () => {
    const res = await captureAll([{ url: fixtureUrl }])
    expect(res[0].image).toMatchImageSnapshot()
  })
})
