declare module '*.css' {
  const children: { [className: string]: string }
  export = content
}
declare module '*.module.css'
declare module "*.module.scss";
declare module "*.svg" {
    const svg: string;
    export default svg;
}
