import type { ReactNode, RefObject } from 'react';

export function StickyHeader({
  children,
  innerRef,
}: {
  children: ReactNode;
  innerRef?: RefObject<HTMLDivElement>;
}) {
  return (
    <header className="hdr" ref={innerRef}>
      {children}
    </header>
  );
}
