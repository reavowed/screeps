function wrapWithColour(str: string, colour: string) {
    return `<font color='${colour}'>${str}</font>`;
}

export class Log {
    static info(...args: any[]) {
        this._log("INFO   ", "green", args);
    }
    static warn(...args: any[]) {
        this._log("WARNING", "yellow", args);
    }
    static error(...args: any[]) {
        this._log("ERROR  ", "red", args);
    }

    static _log(level: string, colour: string, args: any[]) {
        console.log(
            wrapWithColour(level, colour),
            wrapWithColour("(" + Game.time.toString() + ")", "gray"),
            "-",
            ...args
        );
    }
};
