function wrapWithColour(str, colour) {
    return `<font color='${colour}'>${str}</font>`;
}

module.exports = class Log {
    static info(...args) {
        this._log("INFO   ", "green", args);
    }
    static warn(...args) {
        this._log("WARNING", "yellow", args);
    }
    static error(...args) {
        this._log("ERROR  ", "red", args);
    }

    static _log(level, colour, args) {
        console.log(
            wrapWithColour(level, colour),
            wrapWithColour("(" + Game.time.toString() + ")", "gray"),
            "-",
            ...args
        );
    }
};
