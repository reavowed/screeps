import {MovementOverseer, MovementOverseerFactory, MovementOverseerMemory} from "./movementOverseer";
import {CreepOrder, Nest, NestMemory} from "./area.nest";
import {EnergyMine, EnergyMineMemory} from "./area.energyMine";
import * as _ from "lodash";
import {Carrier, CarrierMemory, CarrierSpec} from "./creeps/carrier";
import {Miner, MinerMemory} from "./creeps/miner";
import {isDefined} from "./utils";
import {Log} from "./log"
import {MapUtils} from "./utils.map";

export interface ColonyMemory extends RoomMemory {
    type: "colony",
    movement: MovementOverseerMemory;
    nest: NestMemory,
    energyMines: EnergyMineMemory[]
}

export default class Colony {
    readonly room: Room;
    readonly memory: ColonyMemory;
    readonly movementOverseer: MovementOverseer;
    readonly nest: Nest;
    readonly energyMines: EnergyMine[];
    readonly carrier: Carrier;

    constructor(room: Room, memory: ColonyMemory, creeps: Creep[], movementOverseerFactory: MovementOverseerFactory) {
        this.room = room;
        this.memory = memory;
        this.movementOverseer = movementOverseerFactory.create(this);
        this.nest = new Nest(this, this.memory.nest);
        this.energyMines = this.createEnergyMines(creeps);
        this.carrier = _.find(creeps, c => c.memory.role == "carrier") as Carrier;
    }

    private static isMiner(creep: Creep): creep is Miner {
        return creep.memory.role === "miner";
    }

    private createEnergyMines(creeps: Creep[]): EnergyMine[] {
        const miners = creeps.filter(Colony.isMiner);
        return this.memory.energyMines.map((energyMineMemory, index) => new EnergyMine(
            this,
            energyMineMemory,
            index,
            miners.filter(c => c.memory.mineIndex == index)
        ));
    }

    static load(room: Room, creeps: Creep[]): Colony | void {
        const memory = room.memory.hasOwnProperty("nest") ?
            room.memory as ColonyMemory :
            this.initialiseMemory(room);
        if (memory) {
            return new Colony(room, memory, creeps, new MovementOverseerFactory());
        }
    }

    static initialiseMemory(room: Room): ColonyMemory | void {
        Log.info("Initialising colony at", room.name);

        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) {
            Log.error("Colony at", room.name, "appears to be dead");
            return;
        }
        // TODO: nests with multiple spawns
        if (spawns.length > 1) {
            Log.warn("Colony at", room.name, "somehow has multiple spawns - ignoring all but the first");
        }
        const spawn = spawns[0];

        const nest = {
            spawnId: spawn.id,
            nextCreepId: 1
        };
        const energyMines = _.sortBy(
            _.map(room.find(FIND_SOURCES), source => EnergyMine.initialiseMemory(source, spawn)),
            m => m.pathToMiningPosition.length);

        return {
            type: "colony",
            movement: {},
            nest,
            energyMines
        };
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
        const energyMine = this.energyMines[this.carrier.memory.mineIndex];
        if (MapUtils.getChebyshevDistance(this.carrier.pos, energyMine.miningPosition) === 1) {
            const droppedEnergy = energyMine.droppedEnergy;
            if (droppedEnergy && droppedEnergy.amount >= this.carrier.store.getFreeCapacity()) {
                this.carrier.pickup(droppedEnergy);
                this.carrier.memory.task = "return";
                if (recurse) this.moveCarrierToSpawn(false);
            }
        } else {
            this.movementOverseer.moveCreepByPath(this.carrier, energyMine.memory.pathToMiningPosition);
        }
    }

    moveCarrierToSpawn(recurse: boolean = true) {
        if (this.carrier.memory.returnDirection) {
            this.carrier.move(this.carrier.memory.returnDirection);
            delete this.carrier.memory.returnDirection;
        } else if (MapUtils.getChebyshevDistance(this.carrier.pos, this.nest.spawn.pos) === 1) {
            this.transferCarrierToSpawn(recurse);
        } else if (MapUtils.getChebyshevDistance(this.carrier.pos, this.nest.spawn.pos) === 2 && this.nest.isCreepAboutToSpawn) {
            // Wait for spawning creep
        } else {
            const energyMine = this.energyMines[this.carrier.memory.mineIndex];
            this.movementOverseer.moveCreepBackwardsByPath(this.carrier, energyMine.memory.pathToMiningPosition);
        }
    }

    transferCarrierToSpawn(recurse: boolean) {
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
            this.moveCarrierAwayFromSpawn();
        }
    }

    moveCarrierAwayFromSpawn() {
        const energyMine = this.energyMines[this.carrier.memory.mineIndex];
        if (energyMine.memory.pathToMiningPosition.length > 1) {
            this.carrier.move(energyMine.memory.pathToMiningPosition[1].direction);
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
        const creepOrders = _.flatten([
            this.getFirstMinerCreepOrder(),
            this.getFirstCarrierCreepOrder(),
            this.getMinerCreepOrders()
        ]);
        if (creepOrders.length > 0) {
            const creepOrder = creepOrders[0];
            this.nest.spawnCreep(creepOrder);
        }
    }

    getFirstMinerCreepOrder(): CreepOrder<any>[] {
        if (_.all(this.energyMines, mine => mine.miners.length === 0)) {
            return [this.energyMines[0].getFirstMinerCreepOrder()];
        } else {
            return [];
        }
    }

    getFirstCarrierCreepOrder(): CreepOrder<any>[] {
        if (!this.carrier) {
            const energyMine = _.find(this.energyMines, mine => mine.miners.length > 0);
            if (energyMine) {
                return [{
                    spec: CarrierSpec,
                    options : {
                        memory: {task: "mine", mineIndex: 0},
                        directions: [energyMine.memory.pathToMiningPosition[0].direction]
                    }
                }];
            }
        }
        return [];
    }

    getMinerCreepOrders(): CreepOrder<any>[] {
        if (!_.all(this.energyMines, mine => mine.miners.length === 0)) {
            return _.flatten(_.map(this.energyMines, mine => mine.getAllCreepOrders()));
        }
        return [];
    }
};
