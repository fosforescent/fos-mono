import { TrellisMeta, TrellisNodeInterface, TrellisSerializedData } from '@/react-trellis/trellis/types';
import { DefaultRowComponent, TrellisRowComponentProps } from './row';
import { DefaultRootComponent, TrellisRootComponentProps } from './root';
import { DefaultHeadComponent, TrellisHeadComponentProps } from './head';
import { DefaultRowsComponent, TrellisRowsComponentProps } from './rows';
import { DefaultRowBodyComponent, TrellisRowBodyComponentProps } from './rowBody';
import { DefaultCellComponent, TrellisCellComponentProps } from './cell';
import { DefaultBreadcrumbComponent, TrellisBreadcrumbComponentProps } from './breadcrumb';
import { DefaultBreadcrumbsComponent, TrellisBreadcrumbsComponentProps } from './breadcrumbs';
import { DefaultLoadingComponent, TrellisLoadingComponentProps } from './loading';
import { DefaultMenuComponent, TrellisMenuComponentProps } from './menu';
import { DefaultActionsComponent, TrellisActionsComponentProps } from './actions';



export {
  DefaultRowComponent,
  DefaultRootComponent,
  DefaultHeadComponent,
  DefaultRowsComponent,
  DefaultRowBodyComponent,
  DefaultCellComponent,
  DefaultBreadcrumbComponent,
  DefaultBreadcrumbsComponent,
  DefaultLoadingComponent,
  DefaultMenuComponent,
  DefaultActionsComponent
}

export type TrellisComponent<T extends TrellisNodeInterface<T>, Global, ComponentProps> = React.FC<{
  global: Global,
  meta: TrellisMeta<T, Global>,
  node: T,
  // state: TrellisSerializedData
  // updateState: (state: TrellisSerializedData) => void
} & ComponentProps>;

export type TrellisComponents<T extends TrellisNodeInterface<T>, S> = {
  root: TrellisComponent<T, S, TrellisRootComponentProps<T, S>>,
  head: TrellisComponent<T, S, TrellisHeadComponentProps<T, S>>,
  rows: TrellisComponent<T, S, TrellisRowsComponentProps<T, S>>,
  row: TrellisComponent<T, S, TrellisRowComponentProps<T, S>>,
  rowBody: TrellisComponent<T, S, TrellisRowBodyComponentProps<T, S>>,
  cell: TrellisComponent<T, S, TrellisCellComponentProps<T, S>>,
  breadcrumb: TrellisComponent<T, S, TrellisBreadcrumbComponentProps<T, S>>,
  breadcrumbs: TrellisComponent<T, S, TrellisBreadcrumbsComponentProps<T, S>>,
  loading: TrellisComponent<T, S, TrellisLoadingComponentProps<T, S>>,
  menu: TrellisComponent<T, S, TrellisMenuComponentProps<T, S>>,
  actions: TrellisComponent<T, S, TrellisActionsComponentProps<T, S>>,
}

export type {
  TrellisRowComponentProps,
  TrellisRootComponentProps,
  TrellisHeadComponentProps,
  TrellisRowsComponentProps,
  TrellisRowBodyComponentProps,
  TrellisCellComponentProps,
  TrellisBreadcrumbComponentProps,
  TrellisBreadcrumbsComponentProps,
  TrellisLoadingComponentProps,
  TrellisMenuComponentProps,
  TrellisActionsComponentProps  
}