//! Pure SQL text builders: the `table:rows` filter clause, identifier and
//! string quoting, and the multi-statement splitter.

use std::sync::OnceLock;

use regex::Regex;

use crate::types::FilterCondition;

/// Plain double-quote wrap with NO escaping of embedded quotes —
/// bug-compatible with the TS host.
pub fn quote_ident(name: &str) -> String {
    format!("\"{name}\"")
}

/// Single-quote wrap with embedded quotes doubled.
pub fn sql_string(v: &str) -> String {
    format!("'{}'", v.replace('\'', "''"))
}

fn clause(filter: &FilterCondition) -> String {
    let col = quote_ident(&filter.column);
    let escaped = filter.value.replace('\'', "''");
    match filter.operator.as_str() {
        "=" => format!("{col} = '{escaped}'"),
        "!=" => format!("{col} != '{escaped}'"),
        "contains" => format!("{col} LIKE '%{escaped}%'"),
        "not_contains" => format!("{col} NOT LIKE '%{escaped}%'"),
        "starts_with" => format!("{col} LIKE '{escaped}%'"),
        "ends_with" => format!("{col} LIKE '%{escaped}'"),
        ">" => format!("{col} > '{escaped}'"),
        "<" => format!("{col} < '{escaped}'"),
        ">=" => format!("{col} >= '{escaped}'"),
        "<=" => format!("{col} <= '{escaped}'"),
        "is_null" => format!("{col} IS NULL"),
        "is_not_null" => format!("{col} IS NOT NULL"),
        "in" => {
            let items = filter
                .value
                .split(',')
                .map(|s| sql_string(s.trim()))
                .collect::<Vec<_>>()
                .join(", ");
            format!("{col} IN ({items})")
        }
        "between" => {
            // TS did `String(filter.value2)`, so a missing value2 became "undefined".
            let v2 = filter
                .value2
                .as_deref()
                .unwrap_or("undefined")
                .replace('\'', "''");
            format!("{col} BETWEEN '{escaped}' AND '{v2}'")
        }
        _ => String::new(),
    }
}

/// The full `WHERE …` prefix for `table:rows`, or an empty string. Comparison
/// values are ALWAYS quoted as strings, even numbers — bug-compatible.
pub fn build_filter_clause(filters: &[FilterCondition], logic: &str) -> String {
    let clauses: Vec<String> = filters
        .iter()
        .map(clause)
        .filter(|c| !c.is_empty())
        .collect();
    if clauses.is_empty() {
        return String::new();
    }
    let joiner = if logic == "or" { " OR " } else { " AND " };
    format!("WHERE {}", clauses.join(joiner))
}

/// Split multi-statement SQL on `/;\s*\n|;\s*$/`, trim, drop empties. Naive —
/// does not protect semicolons inside string literals (bug-compatible).
pub fn split_statements(sql: &str) -> Vec<String> {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| Regex::new(r";\s*\n|;\s*$").unwrap());
    re.split(sql)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn f(column: &str, operator: &str, value: &str) -> FilterCondition {
        FilterCondition {
            id: "1".into(),
            column: column.into(),
            operator: operator.into(),
            value: value.into(),
            value2: None,
        }
    }

    #[test]
    fn quotes_idents_without_escaping() {
        assert_eq!(quote_ident("users"), "\"users\"");
        assert_eq!(quote_ident("we\"ird"), "\"we\"ird\"");
    }

    #[test]
    fn quotes_strings_doubling_single_quotes() {
        assert_eq!(sql_string("O'Brien"), "'O''Brien'");
    }

    #[test]
    fn builds_simple_comparisons_string_quoted() {
        assert_eq!(
            build_filter_clause(&[f("age", "=", "30")], "and"),
            "WHERE \"age\" = '30'"
        );
        assert_eq!(
            build_filter_clause(&[f("age", ">=", "18")], "and"),
            "WHERE \"age\" >= '18'"
        );
    }

    #[test]
    fn joins_with_and_or() {
        let filters = [f("a", "=", "1"), f("b", "!=", "2")];
        assert_eq!(
            build_filter_clause(&filters, "and"),
            "WHERE \"a\" = '1' AND \"b\" != '2'"
        );
        assert_eq!(
            build_filter_clause(&filters, "or"),
            "WHERE \"a\" = '1' OR \"b\" != '2'"
        );
    }

    #[test]
    fn builds_like_variants() {
        assert_eq!(
            build_filter_clause(&[f("n", "contains", "x")], "and"),
            "WHERE \"n\" LIKE '%x%'"
        );
        assert_eq!(
            build_filter_clause(&[f("n", "not_contains", "x")], "and"),
            "WHERE \"n\" NOT LIKE '%x%'"
        );
        assert_eq!(
            build_filter_clause(&[f("n", "starts_with", "x")], "and"),
            "WHERE \"n\" LIKE 'x%'"
        );
        assert_eq!(
            build_filter_clause(&[f("n", "ends_with", "x")], "and"),
            "WHERE \"n\" LIKE '%x'"
        );
    }

    #[test]
    fn builds_null_checks_ignoring_value() {
        assert_eq!(
            build_filter_clause(&[f("n", "is_null", "junk")], "and"),
            "WHERE \"n\" IS NULL"
        );
        assert_eq!(
            build_filter_clause(&[f("n", "is_not_null", "")], "and"),
            "WHERE \"n\" IS NOT NULL"
        );
    }

    #[test]
    fn builds_in_from_comma_split_trimmed() {
        assert_eq!(
            build_filter_clause(&[f("id", "in", "1, 2 ,3")], "and"),
            "WHERE \"id\" IN ('1', '2', '3')"
        );
    }

    #[test]
    fn builds_between_from_value2() {
        let mut filter = f("age", "between", "18");
        filter.value2 = Some("65".into());
        assert_eq!(
            build_filter_clause(&[filter], "and"),
            "WHERE \"age\" BETWEEN '18' AND '65'"
        );
    }

    #[test]
    fn between_missing_value2_becomes_undefined() {
        assert_eq!(
            build_filter_clause(&[f("age", "between", "18")], "and"),
            "WHERE \"age\" BETWEEN '18' AND 'undefined'"
        );
    }

    #[test]
    fn escapes_single_quotes_in_values() {
        assert_eq!(
            build_filter_clause(&[f("name", "=", "O'Brien")], "and"),
            "WHERE \"name\" = 'O''Brien'"
        );
    }

    #[test]
    fn drops_unknown_operators() {
        assert_eq!(build_filter_clause(&[f("a", "bogus", "1")], "and"), "");
        assert_eq!(
            build_filter_clause(&[f("a", "bogus", "1"), f("b", "=", "2")], "and"),
            "WHERE \"b\" = '2'"
        );
    }

    #[test]
    fn empty_filters_yield_empty_string() {
        assert_eq!(build_filter_clause(&[], "and"), "");
    }

    #[test]
    fn splits_on_semicolon_newline_and_trailing() {
        assert_eq!(
            split_statements("SELECT 1;\nSELECT 2;"),
            vec!["SELECT 1", "SELECT 2"]
        );
        assert_eq!(split_statements("SELECT 1;  \n  SELECT 2"), vec!["SELECT 1", "SELECT 2"]);
    }

    #[test]
    fn does_not_split_mid_line() {
        assert_eq!(
            split_statements("SELECT 1; SELECT 2"),
            vec!["SELECT 1; SELECT 2"]
        );
    }

    #[test]
    fn does_not_protect_string_literals() {
        // Bug-compatible: the splitter is regex-only.
        assert_eq!(
            split_statements("SELECT ';\n' as x"),
            vec!["SELECT '", "' as x"]
        );
    }

    #[test]
    fn drops_empty_pieces() {
        assert_eq!(split_statements(";\n;\n"), Vec::<String>::new());
        assert_eq!(split_statements(""), Vec::<String>::new());
        assert_eq!(split_statements("a;  \n b;  "), vec!["a", "b"]);
    }
}
