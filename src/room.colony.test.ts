import './globalsForTests';
import Colony, {ColonyMemory} from "./room.colony";
import {CarrierMemory} from "./creeps/carrier";
import {TypedCreep} from "./types";
import "./mastermind"
import {randomId} from "./testUtils";
import * as sinon from 'sinon';
import {Position} from "./utils.map";
import {MovementOverseer, MovementOverseerFactory} from "./movementOverseer";
import {anyOfClass, instance, mock, verify, when} from "ts-mockito";

const colonyName = "N1W1";

const spawn = {
    pos: {x: 1, y: 1}
} as StructureSpawn;
const room = {
  getPositionAt: (pos: Position) => {return {room, ...pos}; }
};
const colonyMemory = {
    nest: {
        spawnId: randomId() as Id<StructureSpawn>
    },
    energyMines: [{
        miningPosition: {x: 5, y: 5},
        pathToMiningPosition: [] as PathStep[]
    }]
} as ColonyMemory;

beforeEach(() => {
    global.Game = {
        getObjectById: sinon.stub()
            .withArgs(colonyMemory.nest.spawnId)
            .returns(spawn)
    } as any as Game;
});

function createCarrier(position: Position, memory: CarrierMemory): TypedCreep<CarrierMemory> {
    return {
        pos: position,
        memory: {
            colonyName,
            role: "carrier",
            ...memory
        },
        moveByPath: sinon.spy()
    } as any as TypedCreep<CarrierMemory>;
}

test('move an empty carrier to its energy mine', () => {
    const carrier = createCarrier(
        { x: 2, y: 2 },
        {
            task: "mine",
            mineIndex: 0
        }
    );
    const overseer = mock(MovementOverseer);
    const factory = mock(MovementOverseerFactory);
    when(factory.create(anyOfClass(Colony))).thenReturn(instance(overseer));
    const colony = new Colony(room as any as Room, colonyMemory, [carrier], instance(factory));

    colony.runCreeps();

    verify(overseer.moveCreepByPath(carrier, colonyMemory.energyMines[0].pathToMiningPosition)).once();
})

test('move a returning carrier to spawn', () => {
    const carrier = createCarrier(
        { x: 4, y: 4 },
        {
            task: "return",
            mineIndex: 0
        }
    );
    const overseer = mock(MovementOverseer);
    const factory = mock(MovementOverseerFactory);
    when(factory.create(anyOfClass(Colony))).thenReturn(instance(overseer));
    const colony = new Colony(room as any as Room, colonyMemory, [carrier], instance(factory));

    colony.runCreeps();

    verify(overseer.moveCreepBackwardsByPath(carrier, colonyMemory.energyMines[0].pathToMiningPosition)).once();
})
