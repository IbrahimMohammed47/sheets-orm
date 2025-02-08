# Google Sheets ORM 🚀
**A serverless, NoSQL-like ORM that turns Google Sheets into a database—zero hosting, full type safety.**  

⚠️ **Warning:** This project is not production-ready (yet)! <br>
⚠️ **Disclaimer**: This project is not affiliated with, endorsed by, or officially supported by Google. It is an independent open-source tool that leverages Google Sheets as a storage backend. Use it at your own discretion.

## What is this?
Google Sheets ORM is a **serverless, NoSQL-like database** that runs on top of Google Sheets. Each of your users gets their own isolated database stored in their Google account. No hosting fees, no centralized failures—just simple, structured storage with TypeScript-powered type safety.

## Installation
```sh
npm install google-sheets-orm
```

## Quickstart: Your Google Sheet, Your Database 📊
```ts
(async function () {
    const refreshToken = "X";  // refresh token that gives our app access to a specific user sheet
    const spreadsheetId = "Y";  // spreadsheet ID
    const client = createOAuthClient(refreshToken);
    const sheetDB = new ClientSheetDB({ client, spreadsheetId });

    // Defining the schema
    const userSchema = [
        { name: "email", validator: SheetTypes.STRING, mapsTo: SheetCols.D },
        { name: "name", validator: SheetTypes.STRING, mapsTo: SheetCols.E },
        { name: "age", validator: SheetTypes.NUMBER, mapsTo: SheetCols.F },
        { name: "birthDate", validator: SheetTypes.DATETIME, mapsTo: SheetCols.G },
        { name: "isMarried", validator: SheetTypes.BOOLEAN, mapsTo: SheetCols.H },
    ] as const;

    // Create a model using the schema
    const userModel = sheetDB.getModel(userSchema);

    // Insert a new user 🎉
    const id = await userModel.insertOne({
        email: "alice@example.com",
        age: 30,
        name: "Alice",
        birthDate: new Date(),
        isMarried: false
    });
    console.log("New user ID:", id);

    // Update user info ✨
    await userModel.updateOne("2", {
        age: 31,
        email: "alice@newdomain.com"
    });

    // Fetch a user 🔍
    const res = await userModel.getOne("8");
    console.log("User found:", res);

    // Delete a user ❌
    await userModel.deleteOne("1");

    // Find multiple users based on conditions 🤖
    await userModel.findMany({
        AND:[
            {   
                name: { startsWith: "a"}    
            },
            {
                OR: [
                    { birthDate: { before: new Date("1997-01-01")} },
                    { isMarried: { eq: true} }, 
                ]
            }
        ]

    });
})();
```

## Why Use This? (The Perks 🎯)
- **🔐 Data security & compliance** – Users own their data in their Google accounts.
- **💰 Zero storage costs** – No need for paid database hosting.
- **⚡ No Single Point of Failure (SPOF)** – Each user has an independent database.
- **🛠️ Type-safe API** – Built with TypeScript for reliability.
- **🌀 NoSQL-like flexibility** – Schema can be adapted dynamically, no migrations required.
- **📁 Comes with Google drive** – Granting permissions for this library include accessing users' Gdrive storages, so you can use this as a free file storage as a bonus!
- **🔗 Seamless integration** – Google Sheets fits effortlessly into existing business workflows, with a vast ecosystem of integrations like Zapier, Google Apps Script, and third-party automation tools.

## What’s the Catch? (Limitations ⚠️)
- **❌ Limited constraints** – No foreign keys, indexing, or strict schema enforcement.
- **🐢 Performance limitations** – Not built for high-speed, large-scale queries.
- **⚠️ Concurrency issues** – No ACID guarantees; partial updates might happen, data conflicts can occur, and there's no built-in locking or transaction rollback.
- **🔍 No complex queries** – Lacks advanced filtering and capabilities like joins and grouping.

## Where Can This Be Useful? (Example Use Cases 💡)
- **🏥 Clinic Management** – Your client doctors can store their patient records securely in their Google Drive.
- **📊 Personal Finance Tracking** – Users manage financial records in structured sheets.
- **🏋️ Gym logger** – Trainees log and track their workout routines.
- **🎓 Educational Tools** – Teachers organize student records and grades collaboratively.
- **📑 Accounting & Expense Management** – Track invoices, expenses, and financial reports seamlessly in Google Sheets.

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

