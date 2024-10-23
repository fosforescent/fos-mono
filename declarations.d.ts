declare module '*.css' {
  const content: { [className: string]: string }
  export = content
}
declare module '*.module.css'
declare module "*.svg" {
    const svg: string;
    export default svg;
}