const Nest = require("./area.nest");
const EnergyMine = require("./area.energyMine");
const MovementOverseer = require("./movementOverseer");

const Searcher = require("./searcher");
const Log = require("./log");
const MapUtils = require("./utils.map");

const carrier = {
    parts: [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
    role: "carrier"
};

module.exports = class Colony {
    constructor(room) {
        this.room = room;
        this.memory = room.memory;
    }

    load() {
        if (!this.memory.initialised) {
            this.initialise();
            this.memory.initialised = true;
        }
        this.movementOverseer = new MovementOverseer(this, this.memory.movement);
        this.loadNest();
        this.loadEnergyMines();
    }

    initialise() {
        Log.info("Initialising colony at", this.room.name);

        this.memory.movement = {};

        const spawns = this.room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) {
            log.error("Colony at", this.room.name, "appears to be dead");
            this.memory.type = "deadColony";
            return;
        }
        // TODO: nests with multiple spawns
        if (spawns.length > 1) {
            log.warn("Colony at", this.room.name, "somehow has multiple spawns - ignoring all but the first");
        }
        const spawn = spawns[0];
        this.memory.nest = {
            spawnId: spawn.id
        };

        this.memory.energyMines = [];
        this.room.find(FIND_SOURCES).forEach(source => {
            let pathFromSpawn = new Searcher(this.room, spawn.pos, source.pos).withTargetRange(1).findSinglePath();
            if (pathFromSpawn === ERR_NO_PATH) {
                Log.warn("Source", source.id, "in colony", this.room.name, "appears to be inaccessible");
                return;
            }
            pathFromSpawn = Room.serializePath(pathFromSpawn);
            this.memory.energyMines.push({
                sourceId: source.id,
                pathFromSpawn
            });
        });
        this.memory.energyMines = _.sortBy(this.memory.energyMines, m => m.pathFromSpawn.length);
    }

    loadNest() {
        this.nest = this.nest || new Nest(this, this.memory.nest);
    }

    loadEnergyMines() {
        this.energyMines = this.energyMines || _.map(this.memory.energyMines, (energyMineMemory, index) => new EnergyMine(this, energyMineMemory, index));
        _.forEach(this.energyMines, energyMine => energyMine.load());
    }

    addCreep(creep) {
        switch (creep.memory.role) {
            case "miner":
                this.energyMines[creep.memory.mine].addCreep(creep);
                break;
            case "carrier":
                this.carrier = creep;
        }
    }

    runCreeps() {
        _.forEach(this.energyMines, mine => mine.runCreeps());
        this.runCarrier();
    }

    runCarrier() {
        if (!this.carrier || this.carrier.spawning) return;
        switch (this.carrier.memory.task) {
            case "mine":
                this.moveCarrierToMine();
                break;
            case "return":
                this.moveCarrierToSpawn();
                break;
        }
    }

    moveCarrierToMine(recurse = true) {
        const energyMine = this.energyMines[this.carrier.memory.mine];
        if (MapUtils.getChebyshevDistance(this.carrier.pos, energyMine.miningPosition) === 1) {
            const droppedEnergy = energyMine.droppedEnergy;
            if (droppedEnergy && droppedEnergy.amount >= this.carrier.store.getFreeCapacity()) {
                this.carrier.pickup(droppedEnergy);
                this.carrier.memory.task = "return";
                if (recurse) this.moveCarrierToSpawn(false);
            }
        } else {
            this.carrier.moveByPath(energyMine.pathFromSpawn);
        }
    }

    moveCarrierToSpawn(recurse = true) {
        if (this.carrier.memory.returnDirection) {
            this.carrier.move(this.carrier.memory.returnDirection);
            delete this.carrier.memory.returnDirection;
        } else if (MapUtils.getChebyshevDistance(this.carrier.pos, this.nest.spawn.pos) === 1) {
            this.transferCarrierToSpawn(recurse);
        } else if (MapUtils.getChebyshevDistance(this.carrier.pos, this.nest.spawn.pos) === 2 && this.nest.isCreepAboutToSpawn) {
            // Wait for spawning creep
        } else {
            const energyMine = this.energyMines[this.carrier.memory.mine];
            this.carrier.moveByPath(energyMine.pathToSpawn);
        }
    }

    transferCarrierToSpawn(recurse) {
        const spawnCapacity = this.nest.spawn.store.getFreeCapacity(RESOURCE_ENERGY);
        if (spawnCapacity > 0) {
            this.carrier.transfer(this.nest.spawn, RESOURCE_ENERGY);
            const carrierEnergy = this.carrier.store.getUsedCapacity(RESOURCE_ENERGY);
            if (spawnCapacity >= carrierEnergy) {
                this.carrier.memory.task = "mine";
                if (recurse) this.moveCarrierToMine(false);
            }
        }
        if (this.nest.isCreepAboutToSpawn) {
            console.log("Panic");
            this.moveCarrierAwayFromSpawn();
        }
    }

    moveCarrierAwayFromSpawn() {
        const energyMine = this.energyMines[this.carrier.memory.mine];
        if (energyMine.pathFromSpawn.length > 1) {
            this.carrier.move(energyMine.pathFromSpawn[1].direction);
            this.carrier.memory.task = "return";
        } else {
            const freeSpace = MapUtils.findAdjacentFreeSpaces(this.room, this.carrier.pos)[0];
            const direction = MapUtils.getExactDirection(this.carrier.pos, freeSpace);
            this.carrier.move(direction.constant);
            this.carrier.memory.returnDirection = MapUtils.reverseDirection(direction).constant;
        }
    }

    buildCreeps() {
        if (!this.nest.canSpawnNewCreep) return;
        const creepOrderGetters = [
            this.getFirstMinerCreepOrder,
            this.getFirstCarrierCreepOrder,
            this.getMinerCreepOrders
        ];
        outer:
        while (creepOrderGetters.length > 0) {
            const creepOrderGetter = creepOrderGetters.shift().bind(this);
            let creepOrders = creepOrderGetter();
            if (creepOrders === undefined) {
                continue;
            }
            if (!_.isArray(creepOrders)) {
                creepOrders = [creepOrders];
            }
            while (creepOrders.length > 0) {
                const creepOrder = creepOrders.shift();
                if (!this.nest.spawnCreep(creepOrder)) {
                    break;
                }
                if (!this.nest.canSpawnNewCreep) break outer;
            }
        }
    }

    getFirstMinerCreepOrder() {
        if (_.all(this.energyMines, mine => mine.miners.length === 0)) {
            return this.energyMines[0].getFirstMinerCreepOrder();
        }
    }

    getFirstCarrierCreepOrder() {
        if (!this.carrier) {
            const energyMine = _.find(this.energyMines, mine => mine.miners.length > 0);
            if (energyMine) {
                return {
                    spec: carrier,
                    memory: {task: "mine", mine: 0},
                    directions: [energyMine.pathFromSpawn[0].direction]
                };
            }
        }
    }

    getMinerCreepOrders() {
        if (!_.all(this.energyMines, mine => mine.miners.length === 0)) {
            return _.flatten(_.map(this.energyMines, mine => mine.getAllCreepOrders()));
        }
    }
};
