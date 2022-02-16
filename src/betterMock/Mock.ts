import {Recorder} from "./Recorder";
import {MockData} from "./MockData";
import {MockDataForMethod} from "./MockDataForMethod";
import {MockDataForField} from "./MockDataForField";

export class Mock<T> {
    private readonly proxyObject: T;
    private readonly mockData: MockData = new MockData();

    constructor() {
        const proxyTarget = {} as any;
        this.proxyObject = new Proxy(proxyTarget, {
            get: (target: any, name: PropertyKey) => {
                if (name === "__mockitoMock") return this;
                return this.invokeProxyGet(name);
            }
        }) as any as T;
    }

    invokeProxyGet(name: PropertyKey): any {
        const mockData = this.mockData.getMockDataForProperty(name);
        if (mockData instanceof MockDataForMethod) {
            return (...args: any[]) => {
                Recorder.lastInvocation = mockData.recordInvocation(args);
                return mockData.getResult(args);
            };
        } else if (mockData instanceof MockDataForField) {
            Recorder.lastInvocation = mockData.recordInvocation();
            return mockData.getResult();
        } else {
            const tentativeMockData = this.mockData.createTentativeFieldData(name);
            Recorder.lastInvocation = tentativeMockData.recordInvocation();
            return (...args: any[]) => {
                const methodMockData = this.mockData.replaceWithMethodData(tentativeMockData);
                Recorder.lastInvocation = methodMockData.recordInvocation(args);
            };
        }
    }

    getProxy(): T {
        return this.proxyObject;
    }

    getVerificationProxy(): T {
        const proxyTarget = {} as any;
        return new Proxy(proxyTarget, {
            get: (target: any, name: PropertyKey) => {
                const mockData = this.mockData.getMockDataForProperty(name);
                if (mockData instanceof MockDataForMethod) {
                    return (...args: any[]) => {
                        mockData.verifyInvocation(args);
                    }
                } else if (mockData instanceof MockDataForField) {
                    mockData.verifyInvocation();
                } else {
                    throw new Error(`No field or method with name ${String(name)} was invoked.`)
                }
            }
        }) as any as T;
    }
}
