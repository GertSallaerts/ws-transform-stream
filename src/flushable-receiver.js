const { Receiver } = require('ws');

/**
 * Flushable version of ws library's Receiver class. This one lets you force
 * the receiver to consume any remaining bytes in its buffer
 */
class FlushableReceiver extends Receiver {
    constructor(...args) {
        super(...args);
        this._isClean = true;
        this._isFlushed = false;
    }

    write(...args) {
        this._isClean = false;
        super.write(...args);
    }

    dataMessage(...args) {
        super.dataMessage(...args);

        if (this._state === 0)
            this._isClean = true;
    }

    controlMessage(...args) {
        super.controlMessage(...args);

        if (this._state === 0)
            this._isClean = true;
    }

    isClean() {
        return this._isClean;
    }

    isFlushed() {
        return this._bufferedBytes === 0;
    }

    flush() {
        if (this.isFlushed())
            return null;

        return this.consume(this._bufferedBytes);
    }
}

module.exports = FlushableReceiver;
