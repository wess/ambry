//! JSON value → SQL literal rules shared by row ops, exports, and mock data.

use serde_json::Value;

use crate::db::filters::{quote_ident, sql_string};

/// `String(v)` for a JSON number, JS-style: integral floats print bare.
fn number_string(n: &serde_json::Number) -> String {
    if let Some(i) = n.as_i64() {
        i.to_string()
    } else if let Some(u) = n.as_u64() {
        u.to_string()
    } else {
        n.as_f64().unwrap_or(0.0).to_string()
    }
}

fn stringify(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Bool(b) => b.to_string(),
        other => serde_json::to_string(other).unwrap_or_default(),
    }
}

/// null → NULL, number → bare, everything else — booleans included — becomes
/// a quoted string ('true'/'false' — bug-compatible).
pub fn literal(v: &Value) -> String {
    match v {
        Value::Null => "NULL".into(),
        Value::Number(n) => number_string(n),
        other => sql_string(&stringify(other)),
    }
}

/// Like [`literal`] but booleans become the TRUE/FALSE keywords — the
/// `export:file` and `table:mockdata` variant.
pub fn literal_bool_kw(v: &Value) -> String {
    match v {
        Value::Bool(b) => if *b { "TRUE" } else { "FALSE" }.into(),
        other => literal(other),
    }
}

/// `"col" = <lit>`, or `"col" IS NULL` for null — the WHERE fragments used by
/// row:update / row:delete.
pub fn where_eq(col: &str, v: &Value) -> String {
    match v {
        Value::Null => format!("{} IS NULL", quote_ident(col)),
        other => format!("{} = {}", quote_ident(col), literal(other)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn null_is_bare_keyword() {
        assert_eq!(literal(&Value::Null), "NULL");
        assert_eq!(literal_bool_kw(&Value::Null), "NULL");
    }

    #[test]
    fn numbers_stay_bare() {
        assert_eq!(literal(&json!(42)), "42");
        assert_eq!(literal(&json!(-7)), "-7");
        assert_eq!(literal(&json!(3.14)), "3.14");
        assert_eq!(literal(&json!(3.0)), "3");
    }

    #[test]
    fn booleans_fall_through_to_string_branch() {
        assert_eq!(literal(&json!(true)), "'true'");
        assert_eq!(literal(&json!(false)), "'false'");
    }

    #[test]
    fn bool_kw_variant_uses_keywords() {
        assert_eq!(literal_bool_kw(&json!(true)), "TRUE");
        assert_eq!(literal_bool_kw(&json!(false)), "FALSE");
        assert_eq!(literal_bool_kw(&json!("x")), "'x'");
        assert_eq!(literal_bool_kw(&json!(2)), "2");
    }

    #[test]
    fn strings_are_quoted_and_escaped() {
        assert_eq!(literal(&json!("hello")), "'hello'");
        assert_eq!(literal(&json!("O'Brien")), "'O''Brien'");
    }

    #[test]
    fn objects_and_arrays_serialize_then_quote() {
        assert_eq!(literal(&json!({"a": 1})), "'{\"a\":1}'");
        assert_eq!(literal(&json!([1, 2])), "'[1,2]'");
    }

    #[test]
    fn where_eq_handles_null_and_values() {
        assert_eq!(where_eq("id", &Value::Null), "\"id\" IS NULL");
        assert_eq!(where_eq("id", &json!(3)), "\"id\" = 3");
        assert_eq!(where_eq("name", &json!("Bob")), "\"name\" = 'Bob'");
        assert_eq!(where_eq("ok", &json!(true)), "\"ok\" = 'true'");
    }
}
