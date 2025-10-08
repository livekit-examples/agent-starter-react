import { useEffect } from 'react';

export function useAutoScroll(scrollContentContainer?: Element | null) {
  useEffect(() => {
    function scrollToBottom() {
      const { scrollingElement } = document;

      if (scrollingElement) {
        scrollingElement.scrollTop = scrollingElement.scrollHeight;
      }
    }

    if (scrollContentContainer && scrollContentContainer.firstElementChild) {
      const resizeObserver = new ResizeObserver(scrollToBottom);

      resizeObserver.observe(scrollContentContainer.firstElementChild);
      scrollToBottom();

      return () => resizeObserver.disconnect();
    }
  }, [scrollContentContainer]);
}
