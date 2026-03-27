export type FilterOperator =
  | "="
  | "!="
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | ">"
  | "<"
  | ">="
  | "<="
  | "is_null"
  | "is_not_null"
  | "in"
  | "between"

export type FilterCondition = {
  id: string
  column: string
  operator: FilterOperator
  value: string
  value2?: string
}

export type FilterState = {
  conditions: FilterCondition[]
  logic: "and" | "or"
}
