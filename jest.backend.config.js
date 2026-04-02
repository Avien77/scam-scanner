/** Jest config for backend unit tests only (Node, CommonJS). */
module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/backend'],
    testMatch: ['**/__tests__/**/*.test.js'],
    clearMocks: true,
};
