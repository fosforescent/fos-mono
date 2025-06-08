import { useState, useEffect, RefObject } from 'react';

export default function useOnScreen(ref: RefObject<HTMLElement>, rootMargin = '0px'): [boolean, IntersectionObserverEntry?] {
  const [isIntersecting, setIntersecting] = useState(false);
  const [entryDetail, setEntryDetail] = useState<IntersectionObserverEntry>();

  useEffect(() => {
    if (!ref.current) return; // Do nothing if the ref is not set

    const observer = new IntersectionObserver(
      ([entry]) => {
        // console.log(entry)
        setIntersecting(entry.isIntersecting);
        setEntryDetail(entry); // Store the entry detail for further use if needed
      },
      {
        rootMargin, 
        threshold: 0.1 // This will trigger the callback even if only 1% of the target is visible
      }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return [isIntersecting, entryDetail];
}
