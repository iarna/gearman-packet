"use strict";

module.exports = require('./packet-types');
module.exports.Emitter = require('./packet-emitter');
module.exports.Parser = require('./packet-parser');

module.exports.withDefaultTypeData = function() {
    return mergedTypeData( [ module.exports ] );
};

module.exports.withTypeData = function( typeData ) {
    return mergedTypeData( [ module.exports, typeData ] );
};

module.exports.withOnlyTypeData = function( typeData ) {
    return mergedTypeData( [ typeData ] );
};

function mergedTypeData( typeDataArray ) {
    var packetTypes = {
        types : {},
        adminTypes : {},
        typesById : []
    };

    typeDataArray.forEach( function( typeData ) {
        if ( 'types' in typeData ) {
            for ( var name in typeData.types ) {
                packetTypes.types[name] = typeData.types[name];
                packetTypes.types[name].name = name;
                packetTypes.typesById[typeData.types[name].id] = typeData.types[name];
            }
        }
        if ( 'adminTypes' in typeData ) {
            for ( var adminName in typeData.adminTypes ) {
                packetTypes.adminTypes[adminName] = typeData.adminTypes[adminName];
                packetTypes.adminTypes[adminName].name = adminName;
            }
        }
    } );

    return packetTypes;
}
