fn main() {
  // The embedded sync core is a build product (`npm run build:core`, run by the Tauri hooks), not a committed file;
  // recompile when it changes and say what to do when it is missing.
  println!("cargo:rerun-if-changed=js/fos-core.js");
  if !std::path::Path::new("js/fos-core.js").exists() {
    panic!("desktop/src-tauri/js/fos-core.js is missing: run `npm run build:core` in desktop/ (the Tauri dev/build hooks do this)");
  }
  tauri_build::build()
}
