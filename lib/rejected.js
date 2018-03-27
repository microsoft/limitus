module.exports = class Rejected extends Error {
    constructor(info) {
        super('Rate limit exceeded.');
        this.info = info;
    }
}
