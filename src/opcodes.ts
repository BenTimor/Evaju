import { parseCsvFile } from "./csv-parse";

type OpcodeCSVLine = {
    Opcode: string;
    Name: string;
    Description: string;
    "Extra Info": string;
    Gas: number;
};

export class OpcodeCSV {
    static opcodeCSVData: OpcodeCSVLine[] = [];

    static async init() {
        OpcodeCSV.opcodeCSVData = await parseCsvFile<{
            Opcode: string,
            Name: string,
            Description: string,
            ["Extra Info"]: string,
            Gas: number,
        }>("opcodes.csv");
    }

    static toBytecode(opcode: string) {
        for (const row of OpcodeCSV.opcodeCSVData.sort((a, b) => b.Name.length - a.Name.length)) {
            opcode = opcode.replaceAll(row.Name, row.Opcode.slice(2));
        }

        opcode = opcode.replaceAll("0x", "").replaceAll(" ", "").replaceAll("\n", "");

        return `0x${opcode}`;
    }
}