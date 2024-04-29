require = require('esm')(module);
module.exports = require('./app.js');
Rejection","errorMessage":"MongooseError: The `uri` parameter to `openUri()` must be a string, got \"undefined\". Make sure the first parameter to `mongoose.connect()` or `mongoose.createConnection()` is a string.", "reason": { "errorType": "MongooseError", "errorMessage": "The `uri` parameter to `openUri()` must be a string, got \"undefined\". Make sure the first parameter to `mongoose.connect()` or `mongoose.createConnection()` is a string.", "stack": ["MongooseError: The `uri` parameter to `openUri()` must be a string, got \"undefined\". Make sure the first parameter to `mongoose.connect()` or `mongoose.createConnection()` is a string.", "    at NativeConnection.Connection.openUri (/var/task/node_modules/mongoose/lib/connection.js:694:11)", "    at /var/task/node_modules/mongoose/lib/index.js:351:10", "    at /var/task/node_modules/mongoose/lib/helpers/promiseOrCallback.js:32:5", "    at new Promise (<anonymous>)", "    at promiseOrCallback (/var/task/node_modules/mongoose/lib/helpers/promiseOrCallback.js:31:10)", "    at Mongoose._promiseOrCallback (/var/task/node_modules/mongoose/lib/index.js:1149:10)", "    at Mongoose.connect (/var/task/node_modules/mongoose/lib/index.js:350:20)", "    at Connect (/var/task/Connection/dbConnect.js:16:14)", "    at Object.<anonymous> (/var/task/app.js:20:1)", "    at Object.<anonymous> (/var/task/node_modules/esm/esm.js:1:251206)", "    at /var/task/node_modules/esm/esm.js:1:245054", "    at Generator.next (<anonymous>)", "    at bl (/var/task/node_modules/esm/esm.js:1:245412)", "    at kl (/var/task/node_modules/esm/esm.js:1:247659)", "    at Object.u (/var/task/node_modules/esm/esm.js:1:287740)", "    at Object.o (/var/task/node_modules/esm/esm.js:1:287137)"] }, "promise": { }, "stack": ["Runtime.UnhandledPromiseRejection: MongooseError: The `uri` parameter to `openUri()` must be a string, got \"undefined\". Make sure the first parameter to `mongoose.connect()` or `mongoose.createConnection()` is a string.", "    at process.<anonymous> (file:///var/runtime/index.mjs:1276:17)", "    at process.emit (node:events:530:35)", "    at process.emit (/var/task/__sourcemap_support.js:587:21)", "    at emit (node:internal/process/promises:150:20)", "    at processPromiseRejections (node:internal/process/promises:284:27)", "    at processTicksAndRejections (node:internal/process/task_queues:96:32)"]}
Unhandled rejection: MongooseError: The `uri` parameter to `openUri()` must be a string, got "undefined".Make sure the first parameter to `mongoose.connect()` or `mongoose.createConnection()` is a string.
    at NativeConnection.Connection.openUri(/var/task / node_modules / mongoose / lib / connection.js: 694: 11)
at /var/task/node_modules / mongoose / lib / index.js: 351: 10
at /var/task/node_modules / mongoose / lib / helpers / promiseOrCallback.js: 32: 5
    at new Promise(<anonymous>)
    at promiseOrCallback (/var/task/node_modules/mongoose/lib/helpers/promiseOrCallback.js:31:10)
    at Mongoose._promiseOrCallback (/var/task/node_modules/mongoose/lib/index.js:1149:10)
    at Mongoose.connect (/var/task/node_modules/mongoose/lib/index.js:350:20)
    at Connect (/var/task/Connection/dbConnect.js:16:14)
    at Object.<anonymous> (/var/task/app.js:20:1)
        at Object.<anonymous> (/var/task/node_modules/esm/esm.js:1:251206)
            at /var/task/node_modules/esm/esm.js:1:245054
            at Generator.next (<anonymous>)
                at bl (/var/task/node_modules/esm/esm.js:1:245412)
                at kl (/var/task/node_modules/esm/esm.js:1:247659)
                at Object.u (/var/task/node_modules/esm/esm.js:1:287740)
                at Object.o (/var/task/node_modules/esm/esm.js:1:287137)
                INIT_REPORT Init Duration: 6992.65 ms	Phase: invoke	Status: error	Error Type: Runtime.ExitError
                Error: Runtime exited with error: exit status 1
