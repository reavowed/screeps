import {any, mock, verify, when} from "./betterMock";

interface Foo {
    getBar(n: number): string
    baz: number
}

describe("mock", () => {
    test("verify a method call", () => {
        const foo = mock<Foo>();

        foo.getBar(3);
        foo.getBar(5);

        verify(foo).getBar(3);
        verify(foo).getBar(5);

        expect(() => verify(foo).getBar(7)).toThrow();
    });

    test("stub a method result", () => {
        const foo = mock<Foo>();

        when(foo.getBar(3)).thenReturn("three");

        expect(foo.getBar(3)).toBe("three");
        expect(foo.getBar(5)).toBeUndefined();
    });

    test("stub a property", () => {
        const foo = mock<Foo>();

        when(foo.baz).thenReturn(5);

        expect(foo.baz).toBe(5);
    })

    test("differentiate stubs with matchers", () => {
        const foo = mock<Foo>();

        when(foo.getBar(any())).thenReturn("whatever");
        when(foo.getBar(3)).thenReturn("three");

        expect(foo.getBar(3)).toBe("three");
        expect(foo.getBar(4)).toBe("whatever");
    })

    test("stub with an answer", () => {
        const foo = mock<Foo>();

        when(foo.getBar(any())).thenAnswer((x: number) => x.toString());

        expect(foo.getBar(3)).toBe("3");
        expect(foo.getBar(5)).toBe("5");
    })
});
