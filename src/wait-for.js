'use strict';

function waitFor(test, options = {}) {
    if (typeof options === 'number')
        options = { interval: options };

    if (typeof test !== 'function')
        throw new TypeError('First argument of waitFor should be a function');

    if (typeof options.interval !== 'number')
        throw new TypeError('Interval of waitFor should be a number');

    if (options.timeout && typeof options.timeout !== 'number')
        throw new TypeError('Timeout of waitFor should be a number');

    return new Promise((resolve, reject) => {
        let resolved = false;
        let timeout;

        if (options.timeout) {
            timeout = setTimeout(() => {
                resolved = true;
                reject(new Error('"waitFor" timed out'));
            }, options.timeout);
        }

        function doTest() {
            try {
                if (resolved)
                    return;

                if (test()) {
                    resolved = true;

                    if (timeout)
                        clearTimeout(timeout);

                    return resolve();
                }

                setTimeout(doTest, options.interval);
            } catch (e) {
                reject(e);
            }
        }

        doTest();
    });
}

module.exports = waitFor;
