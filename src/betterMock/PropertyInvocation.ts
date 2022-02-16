import {Mock} from "./Mock";

export class PropertyInvocation<T> {
    constructor(public name: PropertyKey, public mock: Mock<any>) {}
}

export class PropertyInvocationsForProperty<T> {
    private invocations: PropertyInvocation<T>[] = []
    constructor(public name: PropertyKey) {}
}
