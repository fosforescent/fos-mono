import { useRef, useEffect } from 'react';
import { diff }  from 'deep-object-diff';

export function useTraceUpdate(props: any) {
  const prev = useRef(props);
  useEffect(() => {
    const changedProps = Object.entries(props).reduce((ps: any, [k, v]: any) => {
      if (prev.current[k] !== v) {

        ps[k] = [prev.current[k], v, diff(prev.current[k], v)];
      }
      return ps;
    }, {});
    if (Object.keys(changedProps).length > 0) {
      console.groupCollapsed(`Changed props [&trace] `);
      console.log('Changed props:', changedProps);
      console.trace();
      console.groupEnd();
    }
    prev.current = props;
  });
}