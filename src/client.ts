// import express from 'express';
// import { generateAuthUrl, authUrlCallbackMiddleware } from "./auth"

import { createOAuthClient } from "./auth";
import { SheetCols, SheetFieldKinds } from "./schema";
import { ClientSheetDB } from "./db";
import * as dotenv from 'dotenv'
dotenv.config()
// const app = express();

// app.get('/', (req, res) => {
//     res.send('Hello World');
// });

// app.get('/oauth/callback', authUrlCallbackMiddleware, (req, res) => {
//     res.send('Authenticated');
// });

// app.get('/oauth', (req, res) => {
//     const { authUrl, correlationId } = generateAuthUrl()
//     console.log(correlationId);
//     res.redirect(authUrl);
// });


// app.listen(8080, () => {
//     console.log('Server is running on http://localhost:3000');
// });


const userSchema = [
    { name: "email", kind: SheetFieldKinds.STRING, mapsTo: SheetCols.D },
    { name: "name", kind: SheetFieldKinds.STRING, mapsTo: SheetCols.E },
    { name: "age", kind: SheetFieldKinds.NUMBER, mapsTo: SheetCols.F },
    { name: "birthDate", kind: SheetFieldKinds.DATETIME, mapsTo: SheetCols.G },
    { name: "isMarried", kind: SheetFieldKinds.BOOLEAN, mapsTo: SheetCols.H },
] as const;


; (async function () {
    const refreshToken = process.env.REFRESH_TOKEN as string
    const spreadsheetId = process.env.SHEET_ID as string
    const client = createOAuthClient(refreshToken);
    const sheetDB = new ClientSheetDB({ client, spreadsheetId })
    const clientUserModel = sheetDB.getModel(userSchema)

    // const id = await clientUserModel.insertOne({
    //     email: "h@h.com",
    //     age: 47,
    //     name: "Helal",
    //     birthDate: new Date(),
    //     isMarried: true
    // })
    // console.log(id)

    // await clientUserModel.updateOne("2", {
    //     age: 22,
    //     email: "y@y.y"
    // })

    // const res = await clientUserModel.getOne("8")
    // console.log(res)

    // await clientUserModel.deleteOne("1")

    await clientUserModel.findMany({
        filters: {
            AND: [
                { birthDate: { after: new Date() } },
                { isMarried: { eq: true } },
            ]
        },
        selections: ["age", "email"],
        limit: 12,
        offset: 20
    })
})()