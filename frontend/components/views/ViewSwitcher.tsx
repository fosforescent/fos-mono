import React from 'react';
import { Button } from '@/components/ui/button';
import {
  List,
  GitBranch,
  Pin,
  LayoutGrid,
  CheckSquare
} from 'lucide-react';
import { TrellisSerializedData } from '@fosforescent/shared/types';
import { cn } from '@/lib/utils';

type ViewType = TrellisSerializedData["view"];

interface ViewOption {
  view: ViewType;
  label: string;
  icon: React.ReactNode;
  activity: string;
}

const viewOptions: ViewOption[] = [
  { view: 'Queue', label: 'Queue', icon: <CheckSquare className="h-4 w-4" />, activity: 'todo' },
  { view: 'Tree', label: 'Tree', icon: <GitBranch className="h-4 w-4" />, activity: 'todo' },
  { view: 'Browse', label: 'Pins', icon: <Pin className="h-4 w-4" />, activity: 'pins' },
  { view: 'Focus', label: 'Focus', icon: <LayoutGrid className="h-4 w-4" />, activity: 'focus' },
];

interface ViewSwitcherProps {
  currentView: ViewType;
  onViewChange: (view: ViewType, activity: string) => void;
  className?: string;
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  currentView,
  onViewChange,
  className
}) => {
  return (
    <div className={cn("flex items-center gap-1 p-1 bg-muted rounded-lg", className)}>
      {viewOptions.map((option) => (
        <Button
          key={option.view}
          variant={currentView === option.view ? "default" : "ghost"}
          size="sm"
          className={cn(
            "flex items-center gap-2 px-3",
            currentView === option.view && "shadow-sm"
          )}
          onClick={() => onViewChange(option.view, option.activity)}
          title={option.label}
        >
          {option.icon}
          <span className="hidden sm:inline">{option.label}</span>
        </Button>
      ))}
    </div>
  );
};

export default ViewSwitcher;
