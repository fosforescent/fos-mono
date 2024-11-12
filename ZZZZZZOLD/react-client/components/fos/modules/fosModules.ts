


import cost from './cost'
import workflow from './workflow'
import description from './description'
import duration from './duration'
import probability from './probability'
import fosDocument from './document'
import resources from './resources'
import option from './option'
import root from './root'
import sharing from './sharing'
import comments from './comments'
import budget from './budget'
import importExport from './import_export'
import { FosReactOptions } from '..'
import { IFosNode } from '@/fos-js'
import { TrellisMeta, TrellisSerializedData } from '@/react-trellis'
import { FosWrapper } from '../fosWrapper'
import { FosReactGlobal } from '../../../components/fos'


const fosDataModules = {
  description,
  duration,
  cost,
}

const fosNodeModules = {
  option,
  root,
  comments,
  // probability,d
  // fosDocument,
  // resources,
}

const fosResourceModules = {
  budget,
  workflow,
  importExport,
  sharing
}

const fosReportModules = {

}


const fosModules = {
  ...fosDataModules,
  ...fosNodeModules,
  ...fosResourceModules,
  ...fosReportModules
}

const fosNodeModuleNames = Object.keys(fosNodeModules)
const fosDataModuleNames = Object.keys(fosDataModules)
const fosResourceModuleNames = Object.keys(fosResourceModules)
const fosReportModuleNames = Object.keys(fosReportModules)
const fosModuleNames = [...fosNodeModuleNames, ...fosDataModuleNames, ...fosResourceModuleNames, ...fosReportModuleNames]

type FosModuleProps = {
  node: FosWrapper
  options: FosReactOptions
  meta: TrellisMeta<FosWrapper, FosReactGlobal | undefined>
  state: TrellisSerializedData
  updateState: (state: TrellisSerializedData) => void
}

type FosNodeModule = {
  icon: JSX.Element,
  name: string,
  HeadComponent?: React.FC<FosModuleProps>,
  // rowStyle?: React.CSSProperties,
  RowComponent?: React.FC<FosModuleProps>,
  RowsComponent?: React.FC<FosModuleProps>,
}


type FosDataModule = {
  icon: JSX.Element,
  name: string,
  HeadComponent: React.FC<FosModuleProps>,
  // rowStyle?: React.CSSProperties,
  // RowComponent: React.FC<FosModuleProps>,
}

type FosReportModule = FosNodeModule

type FosResourceModule = FosNodeModule

type FosModule = FosNodeModule | FosDataModule | FosResourceModule | FosReportModule

type FosNodeModuleName = keyof typeof fosNodeModules
type FosDataModuleName = keyof typeof fosDataModules
type FosResourceModuleName = keyof typeof fosResourceModules
type FosReportModuleName = keyof typeof fosReportModules

type FosModuleName = keyof FosModule

export {
  fosModules,
  fosNodeModules,
  fosDataModules,
  fosNodeModuleNames,
  fosDataModuleNames,
  fosResourceModules,
  fosResourceModuleNames,
  fosReportModules,
  fosReportModuleNames,
  fosModuleNames
}

export type {
  FosNodeModule,
  FosDataModule,
  FosNodeModuleName,
  FosDataModuleName,
  FosModuleProps,
  FosModule,
  FosModuleName,
  FosResourceModuleName, 
  FosReportModuleName,
  FosResourceModule,
  FosReportModule

}