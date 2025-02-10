import { defaultFields, SheetCols, SheetField } from "../schema";
import { jsDateToSheetDateStr } from "../utils";


// Define allowed operators based on type
type BaseOperator<T> = { isNull?: boolean; isNotNull?: boolean; eq?: T; neq?: T }
type NumberOperators = BaseOperator<number> & { gt?: number; lt?: number; gte?: number; lte?: number };
type StringOperators = BaseOperator<string> & { contains?: string; like?: string; startsWith?: string; endsWith?: string };
type DateOperators = BaseOperator<Date> & { before?: Date; after?: Date; };
type BooleanOperators = BaseOperator<boolean> & {};

type SheetFieldKindToOperators<SheetFieldKind> =
    SheetFieldKind extends "STRING" ? StringOperators :
    SheetFieldKind extends "NUMBER" ? NumberOperators :
    SheetFieldKind extends "DATETIME" ? DateOperators :
    SheetFieldKind extends "BOOLEAN" ? BooleanOperators :
    never;

type SchemaToFilters<T extends readonly SheetField[]> = {
    [K in T[number]as K["isDeleted"] extends true ? never : K["name"]]:
    SheetFieldKindToOperators<K["kind"]>;
};

type SchemaToSelections<T extends readonly SheetField[]> = (keyof SchemaToFilters<T>)[]
type DefaultFilters = SchemaToFilters<typeof defaultFields>;
// Support for AND/OR logical expressions
type QueryExpression<T extends readonly SheetField[]> =
    | { AND?: Filters<T>[] }
    | { OR?: Filters<T>[] };

// Define QueryInput to allow filtering with logical expressions
type Filters<T extends readonly SheetField[]> =
    Partial<SchemaToFilters<T>>
    & Partial<DefaultFilters>
    & QueryExpression<T>;

export type FindManyArgs<T extends readonly SheetField[]> = {
    filters?: Filters<T>
    selections?: Partial<SchemaToSelections<T>>
    limit?: number
    offset?: number
}
function sqlizeBaseOperators(colName: keyof typeof SheetCols, operators: BaseOperator<any>, quote: boolean = true) {
    const operations: string[] = []
    if (operators.eq != null) {
        operations.push(`${colName} = ${quote ? '"' : ''}${operators.eq}${quote ? '"' : ''}`)
    }
    if (operators.neq != null) {
        operations.push(`${colName} != ${quote ? '"' : ''}${operators.neq}${quote ? '"' : ''}`)
    }
    if (operators.isNull === true) {
        operations.push(`${colName} is null`)
    }
    if (operators.isNotNull === true) {
        operations.push(`${colName} is not null`)
    }
    return operations
}
function sqlizeBooleanOperators(colName: keyof typeof SheetCols, operators: BooleanOperators) {
    const operations: string[] = [...sqlizeBaseOperators(colName, operators, false)]
    return operations
}
function sqlizeNumberOperators(colName: keyof typeof SheetCols, operators: NumberOperators) {
    const operations: string[] = [...sqlizeBaseOperators(colName, operators, false)]
    if (operators.gt != null) {
        operations.push(`${colName} > ${operators.gt}`)
    }
    if (operators.gte != null) {
        operations.push(`${colName} >= ${operators.gte}`)
    }
    if (operators.lt != null) {
        operations.push(`${colName} < ${operators.lt}`)
    }
    if (operators.lte != null) {
        operations.push(`${colName} <= ${operators.lte}`)
    }
    return operations

}
function sqlizeStringOperators(colName: keyof typeof SheetCols, operators: StringOperators) {
    const operations: string[] = [...sqlizeBaseOperators(colName, operators, true)]
    if (operators.contains != null) {
        operations.push(`${colName} contains "${operators.contains}"`)
    }
    if (operators.endsWith != null) {
        operations.push(`${colName} ends with "${operators.endsWith}"`)
    }
    if (operators.startsWith != null) {
        operations.push(`${colName} starts with "${operators.startsWith}"`)
    }
    if (operators.like != null) {
        operations.push(`${colName} like "${operators.like}"`)
    }
    return operations

}
function sqlizeDateOperators(colName: keyof typeof SheetCols, operators: DateOperators) {
    const operations: string[] = []
    if (operators.eq != null) {
        operations.push(`${colName} = datetime "${jsDateToSheetDateStr(operators.eq)}"`)
    }
    if (operators.neq != null) {
        operations.push(`${colName} != datetime "${operators.neq}"`)
    }
    if (operators.after != null) {
        operations.push(`${colName} > datetime "${jsDateToSheetDateStr(operators.after)}"`)
    }
    if (operators.before != null) {
        operations.push(`${colName} < datetime "${operators.before}"`)
    }
    if (operators.isNull === true) {
        operations.push(`${colName} is null`)
    }
    if (operators.isNotNull === true) {
        operations.push(`${colName} is not null`)
    }
    return operations
}

function andClause(operations: string[]) {
    if (operations.length > 1) {
        return operations.map(o => `(${o})`).join(" and ")
    }
    return operations[0] ?? ""
}
function orClause(operations: string[]) {
    if (operations.length > 1) {
        return operations.map(o => `(${o})`).join(" or ")
    }
    return operations[0] ?? ""
}

function parseFilters<T extends readonly SheetField[]>(filters: Filters<T>, schema: readonly [...typeof defaultFields, ...T]): string {
    const tuples = Object.entries(filters)
    const operations: string[] = []
    for (const [key, operators] of tuples) {
        if (key === 'AND' && Array.isArray(operators)) {
            const strings = operators.map(o => parseFilters(o, schema))
            operations.push(andClause(strings))
        } else if (key === 'OR' && Array.isArray(operators)) {
            const strings = operators.map(o => parseFilters(o, schema))
            operations.push(orClause(strings))
        } else {
            const schemaField = schema.find(f => f.name === key)
            if (!schemaField) throw new Error(`Unknown key "${key}"`)
            if (schemaField.kind === 'BOOLEAN') {
                operations.push(andClause(sqlizeBooleanOperators(schemaField.mapsTo, operators as BooleanOperators)))
            } else if (schemaField.kind === 'NUMBER') {
                operations.push(andClause(sqlizeNumberOperators(schemaField.mapsTo, operators as NumberOperators)))
            } else if (schemaField.kind === 'STRING') {
                operations.push(andClause(sqlizeStringOperators(schemaField.mapsTo, operators as StringOperators)))
            } else if (schemaField.kind === 'DATETIME') {
                operations.push(andClause(sqlizeDateOperators(schemaField.mapsTo, operators as DateOperators)))
            } else {
                throw new Error(`Unknown SheetFieldKind "${schemaField.kind}"`)
            }
        }
    }
    return andClause(operations)
}

export function parseQuery<T extends readonly SheetField[]>(query: FindManyArgs<T>, schema: readonly [...typeof defaultFields, ...T]): string {
    const { selections, filters, limit, offset } = query
    // TODO: validate all of those inputs are correct types
    let queryString = "select "
    if (selections && selections.length > 0) {
        queryString += `${selections.join(", ")}\n`
    } else {
        queryString += " *\n"
    }
    if (filters) {
        queryString += `where ${parseFilters(filters, schema)}\n`
    }
    if (limit) {
        queryString += `limit ${limit}\n`
    }
    if (offset) {
        queryString += `offset ${limit}\n`
    }
    return queryString
}