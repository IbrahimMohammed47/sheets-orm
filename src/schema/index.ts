import z from 'zod';
import google, { google as googleClient } from "googleapis"
import { jsDateToSheetDateStr, sheetBoolToJSBool, sheetDateStrToJsDate } from '../utils';
import { parseQuery, FindManyArgs } from '../db/query-parser';

export const SheetCols = {
    A: 'A',
    B: 'B',
    C: 'C',
    D: 'D',
    E: 'E',
    F: 'F',
    G: 'G',
    H: 'H',
    I: 'I',
    J: 'J',
    K: 'K',
    L: 'L',
    M: 'M',
    N: 'N',
    O: 'O',
    P: 'P',
    Q: 'Q',
    R: 'R',
    S: 'S',
    T: 'T',
    U: 'U',
    V: 'V',
    W: 'W',
    X: 'X',
    Y: 'Y',
    Z: 'Z',
} as const
const SheetColsArr = Object.values(SheetCols)


export const SheetFieldKinds = {
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    DATETIME: 'DATETIME',
    BOOLEAN: 'BOOLEAN'
} as const

const sheetFieldKindToValidator = {
    [SheetFieldKinds.STRING]: z.string(),
    [SheetFieldKinds.NUMBER]: z.number().or(z.coerce.number()),
    [SheetFieldKinds.DATETIME]: z.date(),
    [SheetFieldKinds.BOOLEAN]: z.boolean(),

} as const

export type SheetField = {
    name: string;
    kind: keyof typeof SheetFieldKinds;
    mapsTo: keyof typeof SheetCols;
    isDeleted?: boolean;
};


export const defaultFields = [
    { name: 'createdAt', kind: SheetFieldKinds.DATETIME, mapsTo: SheetCols.A, isDeleted: false },
    { name: 'updatedAt', kind: SheetFieldKinds.DATETIME, mapsTo: SheetCols.B, isDeleted: false },
    { name: 'deletedAt', kind: SheetFieldKinds.DATETIME, mapsTo: SheetCols.C, isDeleted: false },
] as const

export type DefaultSheetField = (typeof defaultFields)[number]

type SheetFieldKindToType<SheetFieldKind> =
    SheetFieldKind extends "STRING" ? string :
    SheetFieldKind extends "NUMBER" ? number :
    SheetFieldKind extends "DATETIME" ? Date :
    SheetFieldKind extends "BOOLEAN" ? boolean :
    never;

type ScheetFieldsToType<T extends readonly SheetField[]> = {
    [Field in T[number]as Field["isDeleted"] extends true ? never : Field["name"]]:
    SheetFieldKindToType<Field["kind"]>;
};

type ReservedKeys = typeof defaultFields[number]["name"]

export type InsertInput<T extends readonly SheetField[]> = Omit<ScheetFieldsToType<T>, ReservedKeys>;
export type UpdateInput<T extends readonly SheetField[]> = Partial<Omit<ScheetFieldsToType<T>, ReservedKeys>>;
export type GetOneOptions = { returnSoftDeleted?: boolean }

export class Model<T extends readonly SheetField[]> {
    private schema: readonly [...typeof defaultFields, ...T];
    private client: google.Auth.OAuth2Client;
    private sheetId: string;

    constructor(schema: T, client: google.Auth.OAuth2Client, sheetId: string) {
        this.client = client;
        this.sheetId = sheetId;
        this.schema = [...defaultFields, ...schema] as const;
        this.validateSchema();
    }

    private sheets() {
        return googleClient.sheets({ version: 'v4', auth: this.client }).spreadsheets
    }

    private validateSchema() {
        const sc = this.schema
        if (sc.length > 26) {
            throw new Error("Sheet columns should not exceed 23 columns")
        }
        const nameSet = new Set<string>()
        for (let i = 0; i < sc.length; i++) {
            if (sc[i].mapsTo !== SheetColsArr[i]) {
                throw new Error(`Invalid mapping for ${sc[i].name}`)
            }
            if (nameSet.has(sc[i].name)) {
                throw new Error(`Name ${sc[i].name} can't be used for more than one field`)
            }
            nameSet.add(sc[i].name)
            // TODO: validate structure
        }
    }

    private extractRowNumber(a1Notation: string) {
        const match = a1Notation.match(/![A-Z]+(\d+)/);
        if (!match) throw new Error("Row number couldn't be parsed")
        return match[1];
    }

    private serializeValue(value: any, validator: z.ZodTypeAny) {
        if (value && validator._def.typeName === 'ZodDate') {
            return jsDateToSheetDateStr(value)
        } else if (validator._def.innerType) {
            return this.serializeValue(value, validator._def.innerType)
        } else {
            return value
        }
    }

    private deserializeValue(value: any, zodSchema: z.ZodTypeAny) {
        if (value && zodSchema._def.typeName === 'ZodBoolean') {
            return sheetBoolToJSBool(value)
        }
        if (zodSchema._def.typeName === 'ZodDate') {
            return sheetDateStrToJsDate(value)
        } else if (zodSchema._def.innerType) {
            return this.deserializeValue(value, zodSchema._def.innerType)
        } else {
            return value
        }
    }

    private validateAndSerializeRecord(data: Partial<InsertInput<T>>) {

        let serializedData: any[] = []
        for (const field of this.schema) {
            if (field.name in data) {
                const validator = sheetFieldKindToValidator[field.kind]
                const parsed = validator.parse(data[field.name])
                const serialized = this.serializeValue(parsed, validator)
                serializedData.push(serialized);
            }
            else {
                serializedData.push(null)
            }
        }
        return serializedData
    }

    private isSystemField(fieldName: string) {
        return defaultFields.some(f => f.name === fieldName)
    }

    private deserializeRecord(values: any[]) {
        const entries = this.schema
            .map((f, idx) => [f, idx] as const)
            .filter(([f, _]) => !f.isDeleted)
            .map(([f, idx]) => {
                const validator = sheetFieldKindToValidator[f.kind]
                const v = this.deserializeValue(values[idx], validator)
                return [f.name, v]
            })
        return Object.fromEntries(entries)
    }

    private getSystemFieldCol(fieldName: ReservedKeys) {
        return defaultFields.find(f => f.name === fieldName)?.mapsTo
    }

    async insertOne(data: InsertInput<T>): Promise<string> {
        const fullData = {
            createdAt: new Date(),
            updatedAt: null,
            deletedAt: null,
            ...data
        };
        const dataValues = this.validateAndSerializeRecord(fullData)
        const res = await this.sheets().values.append({
            spreadsheetId: this.sheetId,
            range: 'A1',
            valueInputOption: 'RAW',
            requestBody: {
                values: [dataValues]
                // values: [this.schema.map(field => fullData[field.name as keyof typeof fullData])],
            },
        });
        if (res.data.updates?.updatedRange) {
            return this.extractRowNumber(res.data.updates.updatedRange)
        }
        else {
            throw new Error("Failed to insert data")
        }
    }

    async updateOne(id: string, data: UpdateInput<T>): Promise<boolean> {
        const curr = this.getOne(id)
        if (!curr) {
            throw new Error(`Record of id ${id} not found`)
        }
        let dataInA1Notation: google.sheets_v4.Schema$ValueRange[] = []
        Object.keys(data).forEach(k => {
            const field = this.schema.find(sf => sf.name === k)
            if (!field) {
                throw new Error(`Uknown field "${k}"`)
            }
            if (this.isSystemField(field.name)) {
                throw new Error(`Field "${k} is system field, can't update it manually"`)
            }
            if (field.isDeleted) {
                throw new Error(`Field "${k} was deleted, can't update it"`)
            }
            dataInA1Notation.push({
                range: `${field.mapsTo}${id}`,
                values: [[data[k]]]
            })
        })
        const updatedAtCol = this.getSystemFieldCol('updatedAt')
        dataInA1Notation.push({
            range: `${updatedAtCol}${id}`,
            values: [[new Date()]]
        })

        await this.sheets().values.batchUpdate({
            spreadsheetId: this.sheetId,
            requestBody: {
                data: dataInA1Notation,
                valueInputOption: "RAW"
            },
        })
        return true
    }

    async getOne(id: string, options?: GetOneOptions): Promise<ScheetFieldsToType<T> | null> {
        const res = await this.sheets().values.get({
            spreadsheetId: this.sheetId,
            range: `${id}:${id}`,
        })
        if (res.data.values && !!res.data.values?.[0]?.[0]) { // checks createdAt field
            const rec = this.deserializeRecord(res.data.values[0])
            if (!options?.returnSoftDeleted && rec.deletedAt) {
                return null
            }
            return rec
        }
        return null
    }

    async deleteOne(id: string): Promise<boolean> {
        const curr = this.getOne(id)
        if (!curr) {
            throw new Error(`Record of id ${id} not found`)
        }
        const col = this.getSystemFieldCol('deletedAt')
        await this.sheets().values.update({
            spreadsheetId: this.sheetId,
            range: `${col}${id}`,
            valueInputOption: "RAW",
            requestBody: {
                values: [[new Date()]],
            },
        })
        return true
    }

    async findMany(query: FindManyArgs<T>): Promise<ScheetFieldsToType<T>[]> {
        const res = parseQuery(query, this.schema)
        console.log(res)

        return []
        const queryText = `SELECT * WHERE E = 'Ahmed'`
        // const queryText = `SELECT * WHERE H = TRUE`
        // const queryText = `SELECT * WHERE F = 30`

        const url = `https://docs.google.com/spreadsheets/d/${this.sheetId}/gviz/tq?tqx=out:csv&tq=${encodeURIComponent(queryText)}`;
        const accessTokenRes = await this.client.getAccessToken()
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessTokenRes.token}`,
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const csvData = await response.text();
            console.log(csvData);
        } catch (error) {
            console.error('Error fetching the Google Sheet:', error);
        }

        return []
    }

}

// async function createTable(spreadsheetId: string, title: string) {
//     const res = await google.sheets('v4').spreadsheets.batchUpdate({
//         spreadsheetId,
//         requestBody: {
//             requests: [
//                 { addSheet: { properties: { title } } }
//             ]
//         }
//     })
//     return res
// }
