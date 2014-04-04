"use strict";
var stream = require('stream');
var util = require('util');
var Packet = require('./packet-types');

var Emitter = module.exports = function (options) {
    if (!options) options = {};
    options.objectMode = true;
    stream.Transform.call(this,options);
}
util.inherits(Emitter, stream.Transform);

Emitter.prototype._transform = function (packet, encoding, done) {
    if (packet != null && packet.kind && packet.kind == 'admin') {
        this.encodeAdmin(packet,done);
    }
    else if (packet != null && packet.kind && (packet.kind == 'request' || packet.kind == 'response')) {
        this.encodeGearman(packet,done);
    }
    else if (packet != null && packet.kind) {
        this.emit('error',new Error('Received unknown kind of packet '+packet.kind));
        done();
    }
    else {
        this.emit('error',new Error('Invalid packet, expecting an object with a kind attribute but got ' +
            (packet == null ? 'null' : typeof packet.kind)) );
        done();
    }
}

Emitter.prototype.encodeAdmin = function (packet,done) {
    this.push(new Buffer(packet.command+'\n'));
    done();
}


Emitter.prototype.encodeGearman = function (packet,done) {
    var args = this.encodeGearmanArgs(packet);
    var body = this.encodeGearmanBody(packet);
    var header = this.encodeGearmanHeader(packet,args.length+body.length);

    if (body instanceof stream.Readable) {
        this.push(Buffer.concat([header,args], header.length+args.length));
        var self = this;
        body.on('data', function(chunk){
            self.push( Buffer.isBuffer(chunk) ? chunk : new Buffer(chunk) );
        });
        body.on('end', function () {
            done();
        });
    }
    else {
        this.push(Buffer.concat([header,args,body], header.length+args.length+body.length));
        done();
    }
}

Emitter.prototype.encodeGearmanHeader = function (packet,argsbodylen) {
    var header = new Buffer(12);
    header[0] = '\0';
    header.write((packet.kind=='request'?'REQ':'RES'),1,4,'ascii');
    header.writeUInt32BE(packet.type.id,4);
    header.writeUInt32BE(argsbodylen,8);
    return header;
}

Emitter.prototype.encodeGearmanArgs = function (packet) {
    var argcount = packet.type.args.length;
    if (argcount && !packet.type.body)  -- argcount;
    var args = new Array(argcount);
    var argsbytes = 0;
    for (var ii = 0; ii<argcount; ++ii) {
        var arg = packet.type.args[ii];
        var argvalue = (packet.args && packet.args[arg]!=null) ? packet.args[arg] : '';
        args[ii] = new Buffer( argvalue + '\0');
        argsbytes += args[ii].length;
    }
    return Buffer.concat(args,argsbytes);
}

Emitter.prototype.encodeGearmanBody = function (packet) {
    if (!packet.type.body) {
        if (! packet.type.args.length) {
            return new Buffer(0);
        }
        var arg = packet.type.args[packet.type.args.length-1];
        var bodyvalue = (packet.args && packet.args[arg]!=null) ? packet.args[arg] : '';
        return new Buffer(bodyvalue);
    }
    if (Buffer.isBuffer(packet.body)) {
        return packet.body;
    }
    if (packet.body instanceof stream.Readable) {
        packet.body.length = packet.bodySize;
        return packet.body;
    }
    if (packet.body != null) {
        return new Buffer(packet.body);
    }
    return new Buffer(0);
}
