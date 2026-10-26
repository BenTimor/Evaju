import * as fs from "node:fs";
import Papa from "papaparse";

/**
 * Reads a CSV file into typed rows.
 *
 * Row level problems (for example a documentation row with the wrong number of
 * columns) are tolerated and simply produce incomplete rows; callers validate
 * the fields they need. Only unreadable files and undetectable delimiters throw.
 */
export const parseCsvFileSync = <T>(filePath: string): T[] => {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const results = Papa.parse<T>(fileContent, {
        header: true,
        // Keep everything as strings: dynamic typing would turn "0x00" into 0.
        dynamicTyping: false,
        skipEmptyLines: true,
    });

    const fatalError = results.errors.find(error => error.code === "UndetectableDelimiter" || error.code === "MissingQuotes");

    if (fatalError) {
        throw new Error(`Failed to parse ${filePath}: ${fatalError.message} (row ${fatalError.row})`);
    }

    return results.data;
};

export const parseCsvFile = async <T>(filePath: string): Promise<T[]> => parseCsvFileSync<T>(filePath);
