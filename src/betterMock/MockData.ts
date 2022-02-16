import * as _ from "lodash";
import {MockDataForMethod} from "./MockDataForMethod";
import {MockDataForField} from "./MockDataForField";

export class MockData {
    private mockDataForProperties: (MockDataForMethod<any> | MockDataForField<any>) [] = []
    getMockDataForProperty(name: PropertyKey): MockDataForMethod<any> | MockDataForField<any> | undefined {
        return _.find(this.mockDataForProperties, {name});
    }
    createTentativeFieldData(name: PropertyKey): MockDataForField<any> {
        const mockDataForField = new MockDataForField(name);
        this.mockDataForProperties.push(mockDataForField);
        return mockDataForField;
    }
    replaceWithMethodData<T>(mockDataForField: MockDataForField<T>): MockDataForMethod<T> {
        this.mockDataForProperties = _.filter(this.mockDataForProperties, m => m !== mockDataForField);
        const mockDataForMethod = new MockDataForMethod<T>(mockDataForField.name);
        this.mockDataForProperties.push(mockDataForMethod);
        return mockDataForMethod;
    }
}
