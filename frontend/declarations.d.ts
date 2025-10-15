import { EventSourcePolyfill } from "event-source-polyfill";

declare global {
  interface Window {
    fosEventSource: EventSourcePolyfill
  }
}

declare module '*.css' {
  const classes: { [key: string]: string };
  export default classes;
  export = content
}


declare module "*.svg" {
  const svg: string;
  export default svg;
}
declare module '*.jpg';
declare module '*.gif';

declare module '*.module.css'
declare module "*.module.scss";
