export default {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  extensionsToTreatAsEsm: [".ts"],
  // Source imports use ".js"; map them back to the .ts files.
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  transform: { "^.+\\.ts$": ["ts-jest", { useESM: true }] },
};
