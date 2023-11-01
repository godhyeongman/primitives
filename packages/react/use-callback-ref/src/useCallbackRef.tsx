import * as React from 'react';

/**
 * A custom hook that converts a callback to a ref to avoid triggering re-renders when passed as a
 * prop or avoid re-executing effects when passed as a dependency
 */

/**
 * useCallbackRef 관련 자료글
 * https://hmos.dev/avoid-re-render-by-function-props
 * 1. 콜백 함수를 전달받고 메모이 제이션을 함 -> 최적화 용도
 * 2. 콜백 함수가 메 렌더링 마다 최신화 됨 -> useCallback 빈배열은 이게 안되는데 ref 를통한 참조로 함수 최신화가 이루어짐
 *
 * useCallbackRef를 통해서 비동기 상황에서도 callback 함수의 인자를 지속적으로 업데이트 가능해졌으며, 렌더링이 한번만 일어나게됨
 * 관련해서 만들어본 예제: https://codesandbox.io/s/elegant-glade-jk4346?file=/App.js
 *  */
function useCallbackRef<T extends (...args: any[]) => any>(callback: T | undefined): T {
  const callbackRef = React.useRef(callback);

  React.useEffect(() => {
    callbackRef.current = callback;
  });

  // https://github.com/facebook/react/issues/19240
  return React.useMemo(() => ((...args) => callbackRef.current?.(...args)) as T, []);
}

export { useCallbackRef };
