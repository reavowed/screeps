const MasterMind = require("./mastermind");

module.exports = class MainLoop {
    static loop() {
        const masterMind = new MasterMind();
        masterMind.load();
        masterMind.run();
    }
};
