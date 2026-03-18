import React, { useState } from 'react';
import { ChevronDownIcon } from './Icons';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, defaultCollapsed = false }) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div className="border-t border-slate-800 pt-6 mt-6">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex justify-between items-center text-left hover:opacity-80 transition-opacity"
      >
        <span className="text-sm font-bold uppercase tracking-widest text-slate-400">{title}</span>
        <ChevronDownIcon className={`w-5 h-5 text-slate-500 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
      </button>
      {!isCollapsed && <div className="mt-4 animate-in slide-in-from-top-2 duration-200">{children}</div>}
    </div>
  );
};

export default CollapsibleSection;
