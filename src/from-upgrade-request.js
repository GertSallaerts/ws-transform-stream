'use strict';

const PerMessageDeflate = require('ws/lib/permessage-deflate');
const WsExtensions = require('ws/lib/extension');

const WsTransformStream = require('./ws-transform-stream');

const DEFLATE_EXT_NAME = PerMessageDeflate.extensionName;

function getHeader(source, name) {
    if (!source || typeof source !== 'object')
        return;

    if (source && typeof source.getHeader == 'function')
        return source.getHeader(name) || source.getHeader(name.toLowerCase());

    if (source && typeof source.get == 'function')
        return source.get(name) || source.get(name.toLowerCase());

    return source[name] || source[name.toLowerCase()];
}

function fromUpdgradeHeaders(upgradeReqOrHeaders, options = {}) {
    options.receiver = options.receiver || {};
    options.sender = options.sender || {};

    try {
        const extHeader = getHeader(upgradeReqOrHeaders, 'Sec-Websocket-Extensions');
        const extensions = extHeader && WsExtensions.parse(extHeader);

        // they want to enable PerMessageDeflate
        if (extensions[DEFLATE_EXT_NAME]) {
            options.receiver.extensions = options.receiver.extensions || {};
            options.sender.extensions = options.sender.extensions || {};

            options.receiver.extensions[DEFLATE_EXT_NAME] =
                new PerMessageDeflate({}, true, options.receiver.maxPayload);
            options.receiver.extensions[DEFLATE_EXT_NAME]
                .accept(extensions[DEFLATE_EXT_NAME]);

            options.sender.extensions[DEFLATE_EXT_NAME] =
                new PerMessageDeflate({}, false, options.receiver.maxPayload);
            options.sender.extensions[DEFLATE_EXT_NAME]
                .accept(extensions[DEFLATE_EXT_NAME]);

            options.compress = true;
        }
    } catch (err) {
        // silently fail, server/client will handle the errors in negotiation

        if (options.sender && options.sender.extensions)
            delete options.sender.extensions[DEFLATE_EXT_NAME];

        if (options.receiver && options.receiver.extensions)
            delete options.receiver.extensions[DEFLATE_EXT_NAME];
    }

    return new WsTransformStream(options);
}

module.exports = fromUpdgradeHeaders;
