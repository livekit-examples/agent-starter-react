import { useEffect, useRef } from 'react';

const AUTO_SCROLL_THRESHOLD_PX = 100;

export function useAutoScroll(scrollContentContainer?: Element | null) {
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasUserScrollIntentRef = useRef(false);

  useEffect(() => {
    function scrollToBottom() {
      if (!scrollContentContainer || isUserScrollingRef.current) return;

      scrollContentContainer.scrollTop = scrollContentContainer.scrollHeight;
    }

    function handleUserScrollIntent() {
      hasUserScrollIntentRef.current = true;
    }

    function handleScroll() {
      if (!scrollContentContainer) return;

      const distanceFromBottom =
        scrollContentContainer.scrollHeight -
        scrollContentContainer.clientHeight -
        scrollContentContainer.scrollTop;

      if (distanceFromBottom < AUTO_SCROLL_THRESHOLD_PX) {
        isUserScrollingRef.current = false;
        hasUserScrollIntentRef.current = false;
      } else if (hasUserScrollIntentRef.current) {
        isUserScrollingRef.current = true;

        if (scrollTimeoutRef.current !== null) {
          clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
          isUserScrollingRef.current = false;
          hasUserScrollIntentRef.current = false;
          scrollToBottom();
        }, 3000);
      }
    }

    if (scrollContentContainer) {
      const resizeObserver = new ResizeObserver(scrollToBottom);

      scrollContentContainer.addEventListener('scroll', handleScroll, { passive: true });
      scrollContentContainer.addEventListener('wheel', handleUserScrollIntent, { passive: true });
      scrollContentContainer.addEventListener('touchstart', handleUserScrollIntent, {
        passive: true,
      });

      if (scrollContentContainer.firstElementChild) {
        resizeObserver.observe(scrollContentContainer.firstElementChild);
      }

      scrollToBottom();

      return () => {
        resizeObserver.disconnect();
        scrollContentContainer.removeEventListener('scroll', handleScroll);
        scrollContentContainer.removeEventListener('wheel', handleUserScrollIntent);
        scrollContentContainer.removeEventListener('touchstart', handleUserScrollIntent);
        if (scrollTimeoutRef.current !== null) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }
  }, [scrollContentContainer]);
}
