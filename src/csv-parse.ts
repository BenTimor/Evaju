import * as fs from 'node:fs';
import Papa from 'papaparse';

export const parseCsvFile = <T>(filePath: string): Promise<T[]> => {
    // Read file data
    const fileContent = fs.readFileSync(filePath, 'utf8');

    return new Promise((resolve, reject) => {
        Papa.parse<T>(fileContent, {
            header: true,         // Converts rows into objects based on header names
            dynamicTyping: true,  // Automatically converts numbers and booleans
            skipEmptyLines: true, // Prevents errors from trailing blank lines
            complete: (results) => {
                resolve(results.data);
            },
            error: (error: Error) => {
                reject(error);
            }
        });
    });
};
