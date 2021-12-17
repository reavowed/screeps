import _ from 'lodash';
import sinon from 'sinon';

export function createRoomWithWalls(walls) {
    const room = {};
    room.getPositionAt = (x, y) => { return {x, y}; };

    const terrain = {
        get: sinon.stub()
    };
    terrain.get.returns(0);
    _.forEach(walls, ([x, y]) => terrain.get.withArgs(x, y).returns(TERRAIN_MASK_WALL));
    room.getTerrain = sinon.stub();
    room.getTerrain.returns(terrain);

    room.lookAtArea = () => {
        const result = {};
        for (let y = 0; y < 50; ++y) {
            result[y] = {};
            for (let x = 0; x < 50; ++x) {
                result[y][x] = [{type: "terrain", terrain: "plain"}];
            }
        }
        _.forEach(walls, ([x, y]) => result[y][x][0].terrain = "wall");
        return result;
    };

    return room;
}
