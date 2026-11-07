import React from 'react';
import { useClockStore } from '../store/useClockStore';

interface StandProps {
  children: React.ReactNode;
}

/**
 * Mount wrapper: wall mount for Phase 1, expanded with full desk stand geometry
 * (base block + angled cradle + backward clock tilt) in Phase 2/4.
 */
export const Stand: React.FC<StandProps> = ({ children }) => {
  const mount = useClockStore((s) => s.mount);
  const tilt = mount === 'desk' ? -0.2 : 0;

  return (
    <group>
      <group rotation={[tilt, 0, 0]} position={[0, mount === 'desk' ? 0.25 : 0, 0]}>
        {children}
      </group>
    </group>
  );
};
