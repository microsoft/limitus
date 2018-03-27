module.exports = class Rejected extends Error {
    constructor(info, bucketName) {
        super('Rate limit exceeded.');
        this.info = info;
        this.bucketName = bucketName;
    }
}
