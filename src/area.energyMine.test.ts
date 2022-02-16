import './globalsForTests';
import {EnergyMine, EnergyMineMemory} from './area.energyMine';
import {createRoomWithWalls} from './search.test.common';
import {randomId} from "./testUtils";
import {any, mock, verify, when} from "./betterMock/betterMock";
import Colony from "./room.colony";
import {Nest} from "./area.nest";
import {MovementOverseer} from "./movementOverseer";
import * as _ from "lodash";
import {Miner} from "./creeps/miner";
import {isDefined} from "./utils";
import {Position} from "./utils.map";

beforeEach(() => {
    global.Game = mock<Game>();
});

function createSource(room: Room, x: number, y: number) {
    const source = mock<Source>();
    const sourceId = randomId() as Id<Source>;
    when(source.id).thenReturn(sourceId);
    when(source.pos).thenReturn({x, y, roomName: room.name} as RoomPosition);
    when(source.room).thenReturn(room);
    when(global.Game.getObjectById(sourceId)).thenReturn(source);
    return source;
}

function createSpawn(room: Room, x: number, y: number): StructureSpawn {
    const spawn = mock<StructureSpawn>();
    const spawnId = randomId() as Id<StructureSpawn>;
    when(spawn.id).thenReturn(spawnId);
    when(spawn.pos).thenReturn({x, y, roomName: room.name} as RoomPosition);
    when(spawn.room).thenReturn(room);
    when(global.Game.getObjectById(spawn.id)).thenReturn(spawn);
    return spawn;
}

function createEnergyMine(room: Room, source: Source, spawn: StructureSpawn, memory?: EnergyMineMemory, creeps: Creep[] = []) {
    const colony = mock<Colony>();
    when(colony.room).thenReturn(room);
    when(colony.nest).thenReturn(mock<Nest>());
    when(colony.movementOverseer).thenReturn(mock<MovementOverseer>());
    when(colony.getCreep(any())).thenAnswer((name: String) => _.find(creeps, {name}));
    memory = memory || EnergyMine.initialiseMemory(source, spawn);
    return new EnergyMine(colony, memory, 0, creeps);
}

interface TwoChildrenOptions {
    mainMiner?: Creep
    firstChildMiner?: Creep
    secondChildMiner?: Creep
    approachingMiner?: Creep
}

function createEnergyMineWithTwoSingleChildren(options: TwoChildrenOptions = {}) {
    const room = createRoomWithWalls([
        [29, 21], [30, 21], [31, 21],
        [29, 22], [30, 22], [31, 22]
    ]);
    const source = createSource(room, 30, 21);
    const spawn = createSpawn(room, 30, 15);
    const memory: EnergyMineMemory = {
        sourceId: source.id,
        miningPosition: {
            minerName: options.mainMiner && options.mainMiner.name,
            position: {x: 30, y: 20},
            path: [],
            children: [{
                directionFromParent: RIGHT,
                minerName: options.firstChildMiner && options.firstChildMiner.name,
                children: []
            },{
                directionFromParent: LEFT,
                minerName: options.secondChildMiner && options.secondChildMiner.name,
                children: []
            }]
        },
        approachingMiners: options.approachingMiner ? [options.approachingMiner.name] : []
    };
    const creeps = [options.mainMiner, options.firstChildMiner, options.secondChildMiner, options.approachingMiner].filter(isDefined);

    return createEnergyMine(room, source, spawn, memory, creeps);
}

interface DoubleChildOptions {
    mainMiner?: Miner
    outerChildMiner?: Miner
    innerChildMiner?: Miner
}
function createEnergyMineWithADoubleChild(options: DoubleChildOptions = {}) {
    const room = createRoomWithWalls([
        [29, 21], [30, 21], [31, 21],
        [29, 22], [30, 22], [31, 22]
    ]);
    const source = createSource(room, 30, 21);
    const spawn = createSpawn(room, 24, 15);
    const memory: EnergyMineMemory = {
        sourceId: source.id,
        miningPosition: {
            minerName: options.mainMiner && options.mainMiner.name,
            position: {x: 29, y: 20},
            path: [],
            children: [{
                directionFromParent: RIGHT,
                minerName: options.outerChildMiner && options.outerChildMiner.name,
                children: [{
                    directionFromParent: RIGHT,
                    minerName: options.innerChildMiner && options.innerChildMiner.name,
                    children: []
                }]
            }]
        },
        approachingMiners: []
    };
    const creeps = [options.mainMiner, options.outerChildMiner, options.innerChildMiner].filter(isDefined);

    const energyMine = createEnergyMine(room, source, spawn, memory, creeps);

    return {room, source, spawn, energyMine};
}

interface MinerOptions {
    position: Position,
    fatigue?: number
}
function createMiner(options: MinerOptions): Creep {
    const miner = mock<Creep>();
    when(miner.name).thenReturn(randomId());
    when(miner.pos).thenReturn((options.position || {x: 30, y: 20}) as RoomPosition);
    when(miner.fatigue).thenReturn(options.fatigue || 0);
    const store = mock<StoreDefinition>();
    when(store.getUsedCapacity(RESOURCE_ENERGY)).thenReturn(0);
    return miner;
}

test('pick a central mining space against a wall', () => {
    const room = createRoomWithWalls([
        [29, 21], [30, 21], [31, 21],
        [29, 22], [30, 22], [31, 22]
    ]);
    const source = createSource(room, 30, 21);
    const spawn = createSpawn(room, 30, 15);

    const energyMine = createEnergyMine(room, source, spawn);

    expect(energyMine.memory.miningPosition.position).toEqual({x: 30, y: 20});
    expect(energyMine.memory.miningPosition.children).toHaveLength(2);
    expect(energyMine.memory.miningPosition.children.map(c => c.directionFromParent)).toEqual([RIGHT, LEFT]);
});

test('pick an offset central mining space against a wall', () => {
    const room = createRoomWithWalls([
        [29, 21], [30, 21], [31, 21],
        [29, 22], [30, 22], [31, 22]
    ]);
    const source = createSource(room, 30, 21);
    const spawn = createSpawn(room, 24, 15);

    const energyMine = createEnergyMine(room, source, spawn);

    expect(energyMine.memory.miningPosition.position).toEqual({x: 29, y: 20});
    expect(energyMine.memory.miningPosition.children).toHaveLength(1);
    expect(energyMine.memory.miningPosition.children[0].directionFromParent).toEqual(RIGHT);
    expect(energyMine.memory.miningPosition.children[0].children).toHaveLength(1);
    expect(energyMine.memory.miningPosition.children[0].children[0].directionFromParent).toEqual(RIGHT);
});

test('delegate a distant miner to the movement overseer and continue moving', () => {
    const approachingMiner = createMiner({position: {x: 30, y: 16}});
    const energyMine = createEnergyMineWithTwoSingleChildren({approachingMiner});
    energyMine.runCreeps();

    verify(energyMine.colony.movementOverseer).moveCreepByPath(approachingMiner, energyMine.memory.miningPosition.path);
    expect(energyMine.memory.approachingMiners).toContain(approachingMiner.name);
});

test('move a nearby miner directly and transfer to mining position', () => {
    const approachingMiner = createMiner({position: {x: 30, y: 19}});
    const energyMine = createEnergyMineWithTwoSingleChildren({approachingMiner});
    energyMine.runCreeps();

    verify(approachingMiner).move(RIGHT);
    expect(energyMine.memory.approachingMiners).toHaveLength(0);
    expect(energyMine.memory.miningPosition.minerName).toBe(approachingMiner.name);
});

test('run all miners in two single children', () => {
    const mainMiner = createMiner().withMemory({task: "mine", isMain: true}).withStoredEnergy(10);
    const firstChildMiner = createMiner().withMemory({task: "mine", childIndex: 0}).withStoredEnergy(10);
    const secondChildMiner = createMiner().withMemory({task: "mine", childIndex: 1}).withStoredEnergy(0);

    const {energyMine, source} = createEnergyMineWithTwoSingleChildren([mainMiner, firstChildMiner, secondChildMiner]);

    energyMine.runCreeps();

    expect(mainMiner.harvest).toHaveBeenCalledWith(source);
    expect(firstChildMiner.harvest).toHaveBeenCalledWith(source);
    expect(secondChildMiner.harvest).toHaveBeenCalledWith(source);

    expect(firstChildMiner.transfer).toHaveBeenCalledWith(mainMiner, RESOURCE_ENERGY);
    expect(secondChildMiner.transfer).toHaveBeenCalledTimes(0);
    expect(mainMiner.drop).toHaveBeenCalledWith(RESOURCE_ENERGY);
});

test('move a close miner to the mining position and switch roles', () => {
    const creep = createMiner().withMemory({task: "move"}).atPosition({x: 30, y: 19});
    const {energyMine} = createEnergyMineWithTwoSingleChildren([creep]);
    energyMine.runCreeps();

    expect(creep.move).toHaveBeenCalledWith(BOTTOM);
    expect(energyMine.colony.movementOverseer.moveCreepByPath).toHaveBeenCalledTimes(0);
    expect(creep.memory.task).toBe("mine");
    expect(creep.memory.isMain).toBe(true);
});

test('move an existing miner out of the way into a single child', () => {
    const mainMiner = createMiner().withMemory({task: "mine", isMain: true});
    const mover = createMiner().withMemory({task: "move"}).atPosition({x: 30, y: 19});

    const {energyMine} = createEnergyMineWithTwoSingleChildren([mainMiner, mover]);
    energyMine.runCreeps();

    expect(mover.move).toHaveBeenCalledWith(BOTTOM);
    expect(mainMiner.move).toHaveBeenCalledWith(RIGHT);

    expect(mover.memory.task).toBe("mine");
    expect(mover.memory.isMain).toBe(true);
    expect(mainMiner.memory.isMain).toBe(undefined);
    expect(mainMiner.memory.childIndex).toBe(0);
});

test('move an existing miner out of the way into a second child', () => {
    const mainMiner = createMiner().withMemory({task: "mine", isMain: true});
    const childMiner = createMiner().withMemory({task: "mine", childIndex: 0});
    const mover = createMiner().withMemory({task: "move"}).atPosition({x: 30, y: 19});

    const {energyMine} = createEnergyMineWithTwoSingleChildren([mainMiner, childMiner, mover]);
    energyMine.runCreeps();

    expect(mover.move).toHaveBeenCalledWith(BOTTOM);
    expect(mainMiner.move).toHaveBeenCalledWith(LEFT);
    expect(childMiner.move).toHaveBeenCalledTimes(0);

    expect(mover.memory.task).toBe("mine");
    expect(mover.memory.isMain).toBe(true);
    expect(mainMiner.memory.isMain).toBe(undefined);
    expect(mainMiner.memory.childIndex).toBe(1);
});

test('move an existing miner out of the way into a double child', () => {
    const mainMiner = createMiner().withMemory({task: "mine", isMain: true});
    const mover = createMiner().withMemory({task: "move"}).atPosition({x: 28, y: 19});

    const {energyMine} = createEnergyMineWithADoubleChild([mainMiner, mover]);
    energyMine.runCreeps();

    expect(mover.move).toHaveBeenCalledWith(BOTTOM_RIGHT);
    expect(mainMiner.move).toHaveBeenCalledWith(RIGHT);

    expect(mover.memory.task).toBe("mine");
    expect(mover.memory.isMain).toBe(true);
    expect(mainMiner.memory.isMain).toBe(undefined);
    expect(mainMiner.memory.childIndex).toBe(0);
    expect(mainMiner.memory.isSecondary).toBe(undefined);
});

test('move an existing miner out of the way into an occupied double child', () => {
    const mainMiner = createMiner().withMemory({task: "mine", isMain: true});
    const childMiner = createMiner().withMemory({task: "mine", childIndex: 0, secondary: false});
    const mover = createMiner().withMemory({task: "move"}).atPosition({x: 28, y: 19});

    const {energyMine} = createEnergyMineWithADoubleChild([mainMiner, childMiner, mover]);
    energyMine.runCreeps();

    expect(mover.move).toHaveBeenCalledWith(BOTTOM_RIGHT);
    expect(mainMiner.move).toHaveBeenCalledWith(RIGHT);
    expect(childMiner.move).toHaveBeenCalledWith(RIGHT);

    expect(mover.memory.task).toBe("mine");
    expect(mover.memory.isMain).toBe(true);
    expect(mainMiner.memory.isMain).toBe(undefined);
    expect(mainMiner.memory.childIndex).toBe(0);
    expect(mainMiner.memory.isSecondary).toBe(undefined);
    expect(childMiner.memory.childIndex).toBe(0);
    expect(childMiner.memory.isSecondary).toBe(true);
});

test('recover a main miner from a single child', () => {
    const firstChildMiner = createMiner().withMemory({task: "mine", childIndex: 0});
    const secondChildMiner = createMiner().withMemory({task: "mine", childIndex: 1});

    const {energyMine} = createEnergyMineWithTwoSingleChildren([firstChildMiner, secondChildMiner]);
    energyMine.runCreeps();

    expect(firstChildMiner.move).toHaveBeenCalledWith(LEFT);
    expect(secondChildMiner.move).toHaveBeenCalledTimes(0);
});

test('recover a main miner from a second single child', () => {
    const childMiner = createMiner().withMemory({task: "mine", childIndex: 1});

    const {energyMine} = createEnergyMineWithTwoSingleChildren([childMiner]);
    energyMine.runCreeps();

    expect(childMiner.move).toHaveBeenCalledWith(RIGHT);
});

test('recover a main miner from a double child', () => {
    const firstChildMiner = createMiner().withMemory({task: "mine", childIndex: 0});
    const secondChildMiner = createMiner().withMemory({task: "mine", childIndex: 0, secondary: true});

    const {energyMine} = createEnergyMineWithADoubleChild([firstChildMiner, secondChildMiner]);
    energyMine.runCreeps();

    expect(firstChildMiner.move).toHaveBeenCalledWith(LEFT);
    expect(secondChildMiner.move).toHaveBeenCalledTimes(0);
});


test('rebalance a double child', () => {
    const mainMiner = createMiner().withMemory({task: "mine", isMain: true});
    const childMiner = createMiner().withMemory({task: "mine", childIndex: 0, isSecondary: true});

    const {energyMine} = createEnergyMineWithADoubleChild([mainMiner, childMiner]);
    energyMine.runCreeps();

    expect(childMiner.move).toHaveBeenCalledWith(LEFT);
    expect(mainMiner.move).toHaveBeenCalledTimes(0);
});
