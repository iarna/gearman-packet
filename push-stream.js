"use strict";
var stream = require('stream');
var util = require('util');
var PushStream = require('./push-stream');

var PushStream = module.exports = function (options) {
    stream.Readable.call(this,options);
    this.readable = false;
    this.chunk = null;
    this.next = null;
}
util.inherits(PushStream,stream.Readable);

PushStream.prototype.write = function (chunk,next) {
    if (this.readable) return next(this.readable = this.push(chunk));
    this.chunk = chunk;
    this.next = next;
}

PushStream.prototype._read = function (size) {
    if (this.chunk == null) {
        this.readable = true;
        return;
    }
    this.readable = this.push(this.chunk);
    var next = this.next;
    this.chunk = this.next = null;
    next();
}

