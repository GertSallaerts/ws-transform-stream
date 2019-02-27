'use strict';

const PQueue = require('p-queue');
const { Duplex, PassThrough } = require('stream');
const { Sender } = require('ws');
const PerMessageDeflate = require('ws/lib/permessage-deflate');

const FlushableReceiver = require('./flushable-receiver');
const waitFor = require('./wait-for');

const DEFLATE_EXT_NAME = PerMessageDeflate.extensionName;
const MINUTE = 60000;

class WsTransformStream extends Duplex {

    constructor(options = {}) {
        const {
            transform,
            transformSequential = true,
            sender = {},
            receiver = {},
            compress
        } = options;

        super();

        this._shouldCompress = !!compress;
        this._shouldTransform = typeof transform === 'function';
        this._waiting = false;
        this.transform = this._shouldTransform && transform.bind(this);

        this.transport = new PassThrough();
        this.receiver = new FlushableReceiver(
            receiver.binaryType,
            receiver.extensions,
            receiver.maxPayload,
        );
        this.sender = new Sender(this.transport, sender.extensions);

        this.receiver.on('error', (err) => this.emit('error', err));
        this.receiver.on('ping', (data) => this.sender.ping(data, false));
        this.receiver.on('pong', (data) => this.sender.pong(data, false));
        this.receiver.on('conclude', (code, reason) => {
            // websockets concluded, disable transformations
            this.disable();
            if (code === 1005) this.sender.close(undefined);
            else this.sender.close(code, reason, false);
        });

        this.transport.on('readable', () => this._onDataAvailable());
        this.transport.on('end', () => this._onTransportEnd());
        this.transport.on('close', () => this._onTransportEnd());

        if (transformSequential) {
            this.queue = new PQueue({ concurrency: 1 });
            this.receiver.on('message', message => {
                this.queue.add(() => this._onMessage(message));
            });
        } else {
            this.receiver.on('message', message => this._onMessage(message));
        }
    }

    disable() {
        this._shouldTransform = false;
    }

    _read() {
        this._reading = true;
        let chunk = this.transport.read();

        while (chunk && this._reading) {
            if (this.push(chunk) === false)
                this._reading = false;

            chunk = this.transport.read();
        }

        if (this._ended)
            this.push(null);
    }

    _write(chunk, encoding, cb) {
        if (this._shouldTransform || !this.receiver.isClean()) {
            this.receiver.write(chunk, encoding, cb);
        } else {
            if (!this.receiver.isFlushed())
                this.transport.write(this.receiver.flush());

            this.transport.write(chunk, encoding, cb);
        }
    }

    async _final(cb) {
        await this._onSourceEnd();
        cb();
    }

    async _destroy(err, cb) {
        await this._onSourceEnd();
        cb(err);
    }

    _onDataAvailable() {
        if (this._reading)
            this._read();
    }

    _onMessage(message) {
        Promise.resolve(message)
            .then(input => this._shouldTransform ? this.transform(input) : input)
            .then(output => {
                if (typeof output === 'number') output = output.toString();

                this.sender.send(output, {
                    binary: typeof output !== 'string',
                    mask: false,
                    compress: this._shouldCompress,
                    fin: true
                });
            })
            .catch(err => this.emit('error', err));
    }

    async _onSourceEnd() {
        this.disable();
        await this._cleanupSender();
        this._cleanupReceiver();
        this.transport.end();
    }

    async _onTransportEnd() {
        this._ended = true;
        this._onDataAvailable();
    }

    async _cleanupSender() {
        if (this.sender._extensions[DEFLATE_EXT_NAME])
            this.sender._extensions[DEFLATE_EXT_NAME].cleanup();

        await waitFor(() => this.sender._bufferedBytes === 0, {
            interval: 50,
            timeout: MINUTE,
        });
    }

    _cleanupReceiver() {
        if (this.receiver._extensions[DEFLATE_EXT_NAME])
            this.receiver._extensions[DEFLATE_EXT_NAME].cleanup();

        if (!this.receiver.isFlushed())
            this.transport.write(this.receiver.flush());

        this.receiver.removeAllListeners();
    }
}

module.exports = WsTransformStream;
