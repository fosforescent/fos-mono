import { useState, useEffect, useRef } from 'react'
import throttle from 'lodash.throttle'

interface ScrollEvent {
  scrollY: number
  scrollX: number
}

interface IsScrollingValue {
  isScrolling: boolean
  isScrollingX: boolean
  isScrollingY: boolean
  yScrollPosition: number
  xScrollPosition: number
  yScrollFraction: number
  xScrollFraction: number
  scrollDirectionX: HorizontalScrollDirection
  scrollDirectionY: VerticalScrollDirection
}

enum HorizontalScrollDirection {
  Left = 'left',
  Right = 'right',
  None = 'none',
}

enum VerticalScrollDirection {
  Up = 'up',
  Down = 'down',
  None = 'none',
}

const DEFAULT_VALUE: IsScrollingValue = {
  isScrolling: false,
  isScrollingX: false,
  isScrollingY: false,
  yScrollPosition: 0,
  xScrollPosition: 0,
  yScrollFraction: 0,
  xScrollFraction: 0,
  scrollDirectionX: HorizontalScrollDirection.None,
  scrollDirectionY: VerticalScrollDirection.None,
}

export const useIsScrolling = (): IsScrollingValue => {
  const [value, setValue] = useState(DEFAULT_VALUE)

  const lastEventRef = useRef<ScrollEvent>()
  const scrollTimerRef = useRef<number>()
  

  const listener = () => {
    const { scrollX, scrollY } = window
      
    console.log('useIsScrolling', scrollX, scrollY, document.body.clientHeight, window.innerHeight, document.body.clientWidth, window.innerWidth)

    if (lastEventRef.current) {
      const lastEvent = lastEventRef.current
      const nextIsScrollingX = scrollX !== lastEvent.scrollX
      const nextIsScrollingY = scrollY !== lastEvent.scrollY
      const nextIsScrolling = nextIsScrollingX || nextIsScrollingY

      let nextScrollDirectionX = HorizontalScrollDirection.None
      if (nextIsScrollingX) {
        nextScrollDirectionX =
          scrollX < lastEvent.scrollX
            ? HorizontalScrollDirection.Left
            : HorizontalScrollDirection.Right
      }

      let nextScrollDirectionY = VerticalScrollDirection.None
      if (nextIsScrollingY) {
        nextScrollDirectionY =
          scrollY < lastEvent.scrollY
            ? VerticalScrollDirection.Up
            : VerticalScrollDirection.Down
      }

      setValue({
        isScrolling: nextIsScrolling,
        isScrollingX: nextIsScrollingX,
        isScrollingY: nextIsScrollingY,
        yScrollPosition: scrollY,
        xScrollPosition: scrollX,
        yScrollFraction: scrollY / (document.body.clientHeight - window.innerHeight),
        xScrollFraction: scrollX / (document.body.clientWidth - window.innerWidth),
        scrollDirectionX: nextScrollDirectionX,
        scrollDirectionY: nextScrollDirectionY,
      })

      if (nextIsScrolling) {
        resetTimer()
      } else {
        resetValues()
      }
    }

    lastEventRef.current = { scrollX, scrollY }
  }

  const throttledListener = throttle(listener, 75)

  const resetValues = () => {
    setValue(DEFAULT_VALUE)
  }

  const clearTimer = () => {
    if (scrollTimerRef.current) {
      window.clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = undefined
    }
  }

  const resetTimer = () => {
    clearTimer()
    scrollTimerRef.current = window.setTimeout(onTimerEnded, 250)
  }

  const onTimerEnded = () => {
    clearTimer()
    setValue(DEFAULT_VALUE)
  }


  useEffect(() => {
    document.getElementById("main")?.addEventListener('scroll', throttledListener)
    return () => {
      document.getElementById("main")?.removeEventListener('scroll', throttledListener)
      clearTimer()
    }
  } , [])

  return value
}