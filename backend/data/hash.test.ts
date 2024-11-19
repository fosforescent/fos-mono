import { hashFosContextData } from './util'


import { defaultContext } from '@/fos-js'

describe('hashFosContextData function', () => {
  test('produces the same hash for identical data', () => {
    const data1 = defaultContext
    const data2 = defaultContext

    const hash1 = hashFosContextData(data1)
    const hash2 = hashFosContextData(data2)

    expect(hash1).toEqual(hash2)
  })

  test('produces different hashes for different data', () => {
    const data1 = defaultContext
    const data2 = {
      ...defaultContext,
      nodes: {
        
      }
    }

    const hash1 = hashFosContextData(data1)
    const hash2 = hashFosContextData(data2)

    expect(hash1).not.toEqual(hash2)
  })
})
