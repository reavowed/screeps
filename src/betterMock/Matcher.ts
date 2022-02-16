export class Matcher<T> {
    constructor(public test: (value: T) => boolean) {}
}

export class AnyMatcher<T> extends Matcher<T> {
    constructor() {
        super((t: T) => true);
    }
}

export class EqualsMatcher<T> extends Matcher<T> {
    constructor(value: T) {
        super((t: T) => t === value);
    }
}
