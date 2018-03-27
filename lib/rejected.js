module.exports = class Rejected extends Error {
    constructor() {
        super('Rate limit exceeded.');
    }
}
