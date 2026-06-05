import { useEffect, useRef } from 'react';

const AUTO_SCROLL_THRESHOLD_PX = 100;

export function useAutoScroll(scrollContentContainer?: Element | null) {
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    function scrollToBottom() {
      if (!scrollContentContainer || isUserScrollingRef.current) return;

      const distanceFromBottom =
        scrollContentContainer.scrollHeight -
        scrollContentContainer.clientHeight -
        scrollContentContainer.scrollTop;

      // 如果用户接近底部或者是第一次加载，自动滚动到底部
      if (distanceFromBottom < AUTO_SCROLL_THRESHOLD_PX) {
        scrollContentContainer.scrollTo({
          top: scrollContentContainer.scrollHeight,
          behavior: 'smooth',
        });
      }
    }

    function handleScroll() {
      if (!scrollContentContainer) return;

      // 检测用户是否手动滚动
      const distanceFromBottom =
        scrollContentContainer.scrollHeight -
        scrollContentContainer.clientHeight -
        scrollContentContainer.scrollTop;

      // 如果用户滚动到接近底部，重新启用自动滚动
      if (distanceFromBottom < AUTO_SCROLL_THRESHOLD_PX) {
        isUserScrollingRef.current = false;
      } else {
        // 用户手动滚动到其他位置，暂时禁用自动滚动
        isUserScrollingRef.current = true;

        // 3秒后重新启用自动滚动（如果用户没有继续滚动）
        if (scrollTimeoutRef.current !== null) {
          clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
          isUserScrollingRef.current = false;
        }, 3000);
      }
    }

    if (scrollContentContainer) {
      // 监听内容变化（新消息）
      const resizeObserver = new ResizeObserver(scrollToBottom);

      // 监听用户滚动
      scrollContentContainer.addEventListener('scroll', handleScroll, { passive: true });

      if (scrollContentContainer.firstElementChild) {
        resizeObserver.observe(scrollContentContainer.firstElementChild);
      }

      // 初始滚动到底部
      scrollToBottom();

      return () => {
        resizeObserver.disconnect();
        scrollContentContainer.removeEventListener('scroll', handleScroll);
        if (scrollTimeoutRef.current !== null) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }
  }, [scrollContentContainer]);
}
