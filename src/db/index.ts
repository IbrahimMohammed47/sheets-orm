import google from "googleapis"
import { Model, SheetField } from "../schema";

interface ClientSheetDBOptions {
    client: google.Auth.OAuth2Client;
    spreadsheetId: string;
}

export class ClientSheetDB {

    private client: google.Auth.OAuth2Client;
    private spreadsheetId: string;
    constructor(args: ClientSheetDBOptions) {
        this.client = args.client;
        this.spreadsheetId = args.spreadsheetId;
    }

    getModel<const T extends readonly SheetField[]>(schema: T) {
        return new Model(schema, this.client, this.spreadsheetId);
    }
}