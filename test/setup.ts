import { toMatchImageSnapshot } from 'jest-image-snapshot'

expect.extend({
  toMatchImageSnapshot
})

declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchImageSnapshot(): void
    }
  }
}
