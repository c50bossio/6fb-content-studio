import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface ModalFocusOptions {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(element => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true');
}

export function useModalFocus({ active, containerRef, onClose, initialFocusRef, returnFocusRef }: ModalFocusOptions) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const opener = returnFocusRef?.current || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const background = new Map<HTMLElement, boolean>();
    let modalBranch: HTMLElement = container;
    while (modalBranch !== document.body && modalBranch.parentElement) {
      for (const sibling of modalBranch.parentElement.children) {
        if (sibling !== modalBranch && sibling instanceof HTMLElement && !background.has(sibling)) {
          background.set(sibling, sibling.hasAttribute('inert'));
        }
      }
      modalBranch = modalBranch.parentElement;
    }

    for (const element of background.keys()) element.setAttribute('inert', '');
    const initialFocus = initialFocusRef?.current || container;
    initialFocus.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = focusableElements(container);
      if (!focusable.length) {
        event.preventDefault();
        initialFocus.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || activeElement === container || activeElement === initialFocus)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || activeElement === initialFocus || !container.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      for (const [element, wasInert] of background) {
        if (!wasInert) element.removeAttribute('inert');
      }
      if (opener?.isConnected) opener.focus();
    };
  }, [active, containerRef, initialFocusRef, returnFocusRef]);
}
