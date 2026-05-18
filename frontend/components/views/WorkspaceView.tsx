import React, { useMemo } from 'react';
import { useProps } from '@/App';
import { AppStateLoaded, FosPath, FosReactGlobal, TrellisSerializedData } from '@fosforescent/shared/types';
import { getActions } from '@/lib/actions';

import { ViewSwitcher } from './ViewSwitcher';
import QueueView from './QueueLayout';
import { TreeView } from './tree/TreeLayout';
import { BrowseView } from './BrowseLayout';
import { FocusView } from './FocusLayout';

type ViewType = TrellisSerializedData["view"];

/**
 * WorkspaceView - Main workspace component that renders different views
 * based on the current trellisData.view setting.
 *
 * Supports switching between:
 * - Queue: Task queue/inbox view
 * - Tree: Hierarchical tree view
 * - Browse: Pin/grid view
 * - Focus: Focused execution view
 */
export const WorkspaceView: React.FC = () => {
  const {
    data,
    setData,
    options,
    nodeRoute: route,
  }: {
    options: FosReactGlobal;
    data: AppStateLoaded;
    nodeRoute: FosPath;
    setData: (state: AppStateLoaded) => void;
  } = useProps();

  const currentView = data.data.trellisData.view;

  const { setViewActivityMode } = getActions(options, data, setData);

  const handleViewChange = (view: ViewType, activity: string) => {
    setViewActivityMode(view, activity, 'default');
  };

  // Render the appropriate view based on currentView
  const renderView = () => {
    switch (currentView) {
      case 'Queue':
        return <QueueView />;
      case 'Tree':
        return <TreeView />;
      case 'Browse':
        return <BrowseView />;
      case 'Focus':
        return <FocusView />;
      default:
        return <QueueView />;
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* View Switcher Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <ViewSwitcher
          currentView={currentView}
          onViewChange={handleViewChange}
        />
      </div>

      {/* Main View Content */}
      <div className="flex-1 overflow-auto">
        {renderView()}
      </div>
    </div>
  );
};

export default WorkspaceView;
