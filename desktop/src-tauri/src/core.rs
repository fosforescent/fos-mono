//! The TypeScript sync core (shared/sync), bundled to js/fos-core.js and run
//! in-process with QuickJS. Rust never re-implements merge/sync semantics: it
//! only moves JSON strings in and out, so the CLI, the REPL and the GUI agree.

use rquickjs::{Context, Function, Runtime};
use serde_json::Value;

const CORE_JS: &str = include_str!("../js/fos-core.js");

pub struct Core {
    _runtime: Runtime,
    context: Context,
}

#[derive(Debug)]
pub struct CoreError(pub String);

impl std::fmt::Display for CoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for CoreError {}

impl Core {
    pub fn new() -> Result<Core, CoreError> {
        let runtime = Runtime::new().map_err(|e| CoreError(e.to_string()))?;
        let context = Context::full(&runtime).map_err(|e| CoreError(e.to_string()))?;
        context
            .with(|ctx| -> rquickjs::Result<()> {
                let globals = ctx.globals();
                globals.set(
                    "__hostLog",
                    Function::new(ctx.clone(), |level: String, message: String| {
                        if level == "error" || level == "warn" || std::env::var("FOS_DEBUG").is_ok() {
                            eprintln!("[core:{}] {}", level, message);
                        }
                    })?,
                )?;
                globals.set(
                    "__hostRandom",
                    Function::new(ctx.clone(), || -> u32 { rand::random::<u8>() as u32 })?,
                )?;
                ctx.eval::<(), _>(CORE_JS)?;
                Ok(())
            })
            .map_err(|e| CoreError(format!("failed to load the sync core: {}", e)))?;
        Ok(Core { _runtime: runtime, context })
    }

    /// Call `fosCore.<name>(...args)`; returns its (JSON) result or the JS error message.
    pub fn call(&self, name: &str, args: &[Value]) -> Result<Value, CoreError> {
        let args_json = serde_json::to_string(args).map_err(|e| CoreError(e.to_string()))?;
        let raw: String = self
            .context
            .with(|ctx| -> rquickjs::Result<String> {
                let entry: Function = ctx.globals().get("__call")?;
                entry.call((name, args_json.as_str()))
            })
            .map_err(|e| CoreError(format!("{}: {}", name, e)))?;
        let parsed: Value = serde_json::from_str(&raw).map_err(|e| CoreError(e.to_string()))?;
        if let Some(err) = parsed.get("error").and_then(|e| e.as_str()) {
            return Err(CoreError(format!("{}: {}", name, err)));
        }
        Ok(parsed.get("ok").cloned().unwrap_or(Value::Null))
    }

    /// Call a core function that returns a JSON string, and parse it.
    pub fn call_json(&self, name: &str, args: &[Value]) -> Result<Value, CoreError> {
        match self.call(name, args)? {
            Value::String(s) => serde_json::from_str(&s).map_err(|e| CoreError(format!("{}: bad json: {}", name, e))),
            other => Ok(other),
        }
    }

    pub fn call_string(&self, name: &str, args: &[Value]) -> Result<String, CoreError> {
        match self.call(name, args)? {
            Value::String(s) => Ok(s),
            Value::Null => Ok(String::new()),
            other => Ok(other.to_string()),
        }
    }
}

pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn core_loads_and_round_trips_a_replica() {
        let core = Core::new().expect("core");
        core.call("open", &[json!("h"), Value::Null, json!("dev")]).unwrap();
        // a device root's own rows live in Home
        let home = core.call_string("homePath", &[json!("h")]).unwrap();
        assert_eq!(home, r#"["fos:home"]"#);
        let task = core.call_json("addTask", &[json!("h"), json!(home), json!("hello"), json!(1)]).unwrap();
        assert_eq!(task["title"], "hello");
        let tree = core.call_json("tree", &[json!("h"), json!("[]")]).unwrap();
        // the tree leaves out the library the store ships; the rows are under Home
        assert!(!tree.as_array().unwrap().iter().any(|line| line.as_str().unwrap().contains("Standard library")));
        assert!(tree.as_array().unwrap().iter().any(|line| line.as_str().unwrap().contains("hello")));
        let serialized = core.call_string("serialize", &[json!("h")]).unwrap();
        core.call("open", &[json!("h2"), json!(serialized), json!("dev")]).unwrap();
        assert_eq!(core.call_json("view", &[json!("h2"), json!("[]")]).unwrap()["tasks"].as_array().unwrap().len(), 2);
        assert_eq!(core.call_json("view", &[json!("h2"), json!(home)]).unwrap()["tasks"][0]["title"], "hello");
        // a project store is a device root of its own (it ships the library too), with its rows at its root, no Home
        core.call("open", &[json!("p"), Value::Null, json!("dev"), json!(false)]).unwrap();
        let row = core.call_json("addTask", &[json!("p"), json!("[]"), json!("in project"), json!(2)]).unwrap();
        assert_eq!(row["title"], "in project");
        assert_eq!(core.call_string("homePath", &[json!("p")]).unwrap(), "[]");
        assert_eq!(core.call_json("tree", &[json!("p"), json!("[]")]).unwrap().as_array().unwrap().len(), 1);
        assert!(core.call("nope", &[]).is_err());
    }
}
