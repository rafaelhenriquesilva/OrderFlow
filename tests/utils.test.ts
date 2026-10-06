import { add, getErrorMessage } from "../src/utils";

describe("utils", () => {
  test("adds numbers", () => {
    expect(add(2, 3)).toBe(5);
  });

  test("gets error message from Error", () => {
    const err = new Error("Something went wrong");
    expect(getErrorMessage(err)).toBe("Something went wrong");
  });

  test("gets error message from string", () => {
    expect(getErrorMessage("Oops")).toBe("Oops");
  });
});