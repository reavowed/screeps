const MasterMind = require("./mastermind");

module.exports = class MainLoop {
    static loop() {
        try {
            const masterMind = new MasterMind();
            masterMind.load();
            masterMind.run();
        } catch (e) {
            console.log(e.stack);
        }
    }
};
