


import cost from './cost'
import todo from './todo'
import description from './description'
import duration from '../fields/duration'

import resources from './resources'
import option from './option'
import root from './root'
import sharing from './sharing'
import comments from './comments'
import budget from './budget'
import importExport from '../fields/import_export'



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
  todo,
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




type FosModule = typeof fosModules[keyof typeof fosModules] & {
  RowComponent?: React.FC<any>;
  HeadComponent?: React.FC<any>;
}

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
  FosNodeModuleName,
  FosDataModuleName,
  FosModule,
  FosModuleName,
  FosResourceModuleName, 
  FosReportModuleName,
}