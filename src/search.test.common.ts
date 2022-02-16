import * as _ from 'lodash';
import {anyNumber, anything, instance, when, mock} from "ts-mockito";
import {} from "./betterMock/betterMock"

export function createRoomWithWalls(walls: [number, number][]): Room {
    const room = mock<Room>();
    when(room.getPositionAt(anyNumber(), anyNumber())).thenCall((x: number, y: number) => { return {x, y}; });
    const terrain = mock<RoomTerrain>();
    when(room.getTerrain()).thenReturn(instance(terrain));
    when(terrain.get(anyNumber(), anyNumber())).thenReturn(0);
    _.forEach(walls, ([x, y]) => when(terrain.get(x, y)).thenReturn(TERRAIN_MASK_WALL));
    const matrix = getLookAtResultMatrix(walls);
    when(room.lookAtArea(anything(), anything(), anything(), anything())).thenReturn(matrix);
    return {
        ...instance(room),
        terrain: undefined,
        costs: undefined,
        allObjects: undefined
    } as any as Room;
}

function getLookAtResultMatrix(walls: [number, number][]): LookAtResultMatrix {
    const result = {} as LookAtResultMatrix;
    for (let y = 0; y < 50; ++y) {
        result[y] = {};
        for (let x = 0; x < 50; ++x) {
            result[y][x] = [{type: "terrain", terrain: "plain"}];
        }
    }
    _.forEach(walls, ([x, y]) => result[y][x][0].terrain = "wall");
    return result;
}
