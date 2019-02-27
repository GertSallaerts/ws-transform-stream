
const WsTransformStream = require('./ws-transform-stream');
const fromUpgradeRequest = require('./from-upgrade-request');

module.exports = WsTransformStream;
Object.assign(module.exports, {
    fromUpgradeRequest
});
