const Colony = require("./room.colony");

module.exports = class Mastermind {
    load() {
        this.scanRooms();
        this.loadColonies();
        this.loadCreeps();
    }
    scanRooms() {
        this.colonies = {};
        _.forEach(Game.rooms, room => {
            if (!room.memory.scanned) {
                this.scanRoom(room);
            }
            if (room.memory.type === "colony") {
                this.colonies[room.name] = new Colony(room);
            }
        });
    }

    scanRoom(room) {
        if (room.controller && room.controller.my) {
            room.memory.type = "colony";
        }
        room.memory.scanned = true;
    }

    loadColonies() {
        _.forEach(this.colonies, colony => colony.load());
    }

    loadCreeps() {
        _.forEach(Game.creeps, creep => this.colonies[creep.memory.colony].addCreep(creep));
    }

    run() {
        _.forEach(this.colonies, colony => colony.runCreeps());
        _.forEach(this.colonies, colony => colony.buildCreeps());
    }
};
