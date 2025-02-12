export function jsBoolToSheetBool(b: boolean) {
    return b === true ? "TRUE" : "FALSE";
}
export function sheetBoolToJSBool(b: string): boolean | undefined {
    if (b === "TRUE") return true;
    if (b === "FALSE") return false;
    return undefined;
}
export function jsDateToSheetDateStr(date: Date) {
    let options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3, // Supports milliseconds
        hour12: false,
        timeZone: "UTC",
    };
    return new Intl.DateTimeFormat("en-CA", options)
        .format(date)
        .replace(",", "") // Remove comma from the format
        .replace(/\//g, "-"); // Replace slashes with dashes
}

export function sheetDateStrToJsDate(dateTimeStr: string): Date | undefined {
    const match = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/.test(
        dateTimeStr
    );
    if (!match) return undefined;
    let [datePart, timePart] = dateTimeStr.split(" "); // Split date and time
    let [year, month, day] = datePart.split("-").map(Number); // Extract date
    let [hour, minute, secondMS] = timePart.split(":"); // Extract time
    let [second, millisecond] = secondMS.split(".").map(Number); // Extract seconds and milliseconds
    return new Date(
        Date.UTC(
            year,
            month - 1,
            day,
            Number(hour),
            Number(minute),
            second,
            millisecond || 0
        )
    );
}
